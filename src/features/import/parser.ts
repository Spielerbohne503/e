import { z } from 'zod'
import { CATEGORIES, ITEM_KINDS } from '@/shared/api'

/**
 * Parsing what a language model handed back for a photographed receipt.
 *
 * The app never talks to a vision API itself. The person copies a prompt,
 * pastes it into ChatGPT or Claude along with the photo, and pastes the
 * answer back in here. So this parser has to be forgiving about the shapes
 * a model actually produces, while still refusing anything it cannot read.
 */

/** Accepts 349, "349", "3,49" and "3.49" and returns minor units. */
const Betrag = z.union([z.number(), z.string()]).transform((wert, ctx) => {
  if (typeof wert === 'number') {
    if (!Number.isFinite(wert)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Keine gültige Zahl' })
      return z.NEVER
    }
    // A model that ignored the "integer cents" rule and wrote 3.49 for 3,49 €
    // would silently become 3 cents. Round instead of truncating.
    return Math.round(wert)
  }

  const bereinigt = wert.replace(/[^\d,.\-]/g, '').trim()
  if (!bereinigt) return 0

  const letztesKomma = bereinigt.lastIndexOf(',')
  const letzterPunkt = bereinigt.lastIndexOf('.')
  const schnitt = Math.max(letztesKomma, letzterPunkt)

  // "1.234,56" and "1,234.56" both mean the same thing to a reader.
  const normalisiert =
    schnitt === -1
      ? bereinigt
      : `${bereinigt.slice(0, schnitt).replace(/[.,]/g, '')}.${bereinigt.slice(schnitt + 1).replace(/[.,]/g, '')}`

  const zahl = Number(normalisiert)
  if (!Number.isFinite(zahl)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Keine gültige Zahl' })
    return z.NEVER
  }

  // A decimal point means the model wrote euros, not cents.
  return schnitt === -1 ? Math.round(zahl) : Math.round(zahl * 100)
})

const OptionalerBetrag = Betrag.nullish().transform((v) => v ?? 0)

/** Missing optional fields come back as null, never undefined. */
const nullbar = <S extends z.ZodTypeAny>(schema: S) =>
  schema.nullish().transform((v: z.output<S> | null | undefined) => v ?? null)

const ImportPosition = z.object({
  name: z.string().default('?'),
  name_clean: nullbar(z.string()),
  qty: nullbar(z.union([z.number(), z.string()])),
  unit_price: nullbar(Betrag),
  total: Betrag,
  kind: nullbar(z.enum(ITEM_KINDS)),
  category: nullbar(z.string()),
  suggested_for: z.array(z.string()).nullish().transform((v) => v ?? []),
})

export const ImportBeleg = z.object({
  schema: nullbar(z.string()),
  merchant: nullbar(z.string()),
  date: z
    .string()
    .nullish()
    .transform((d) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null)),
  currency: z
    .string()
    .nullish()
    .transform((c) => (c && /^[A-Za-z]{3}$/.test(c) ? c.toUpperCase() : 'EUR')),
  items: z.array(ImportPosition).default([]),
  subtotal: OptionalerBetrag,
  tax: OptionalerBetrag,
  tip: OptionalerBetrag,
  deposit: OptionalerBetrag,
  discounts: OptionalerBetrag,
  total: OptionalerBetrag,
  balanced: nullbar(z.boolean()),
  confidence: nullbar(z.number()),
})

export type ImportBelegDaten = z.infer<typeof ImportBeleg>

export interface ParseErfolg {
  ok: true
  daten: ImportBelegDaten
  /** Set when the numbers do not add up — saving is still allowed. */
  warnung: string | null
}

export interface ParseFehler {
  ok: false
  nachricht: string
  /** 1-based line the problem sits on, when we can work it out. */
  zeile: number | null
}

/**
 * Strips markdown fences and whatever prose a model wrapped around the JSON,
 * then validates. Returns a readable message rather than a stack trace.
 */
export function parseImport(roh: string): ParseErfolg | ParseFehler {
  const text = schaleAbziehen(roh)
  if (!text) return { ok: false, nachricht: 'Da ist kein Text zum Einlesen', zeile: null }

  let daten: unknown
  try {
    daten = JSON.parse(text)
  } catch (e) {
    return { ok: false, nachricht: leseJsonFehler(e), zeile: zeileAus(e, text) }
  }

  const ergebnis = ImportBeleg.safeParse(daten)
  if (!ergebnis.success) {
    const issue = ergebnis.error.issues[0]
    const pfad = issue?.path.join('.') ?? ''
    return {
      ok: false,
      nachricht: pfad
        ? `${pfad}: ${issue?.message ?? 'Wert passt nicht'}`
        : (issue?.message ?? 'Die Daten passen nicht zum Schema'),
      zeile: null,
    }
  }

  return { ok: true, daten: ergebnis.data, warnung: pruefeSumme(ergebnis.data) }
}

/**
 * Removes code fences and any text before the first brace or after the last.
 * Models like to explain themselves even when told not to.
 */
function schaleAbziehen(roh: string): string {
  let text = roh.trim()

  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  if (fence?.[1]) text = fence[1].trim()

  const start = text.indexOf('{')
  const ende = text.lastIndexOf('}')
  if (start !== -1 && ende > start) text = text.slice(start, ende + 1)

  return text.trim()
}

function leseJsonFehler(e: unknown): string {
  const roh = e instanceof Error ? e.message : String(e)
  // V8 messages are precise but not readable; keep the useful part.
  if (/Unexpected end of JSON/i.test(roh)) return 'Das JSON hört mitten drin auf'
  if (/Unexpected token/i.test(roh)) return 'An einer Stelle steht ein Zeichen, das dort nicht hingehört'
  if (/Expected property name/i.test(roh)) return 'Ein Feldname fehlt oder steht ohne Anführungszeichen da'
  return 'Das ist kein gültiges JSON'
}

/**
 * Works out which line the problem sits on. V8 has changed how it reports
 * this more than once, so all three shapes are handled and the whole thing
 * degrades to "no line number" rather than to a wrong one.
 */
function zeileAus(e: unknown, text: string): number | null {
  const roh = e instanceof Error ? e.message : ''

  // Newer V8: "... (line 3 column 14)".
  const zeileSpalte = /line (\d+) column \d+/i.exec(roh)
  if (zeileSpalte?.[1]) return Number(zeileSpalte[1])

  // Older V8: "... at position 42".
  const position = /position (\d+)/i.exec(roh)
  if (position?.[1]) {
    const index = Number(position[1])
    if (Number.isFinite(index)) return text.slice(0, index).split('\n').length
  }

  // Node 22 and current Chrome quote the offending snippet instead:
  //   Unexpected token ',', ..."items": [,]" is not valid JSON
  const schnipsel = /\.\.\.?"(.+)" is not valid JSON/s.exec(roh)?.[1]
  if (schnipsel) {
    const stelle = text.indexOf(schnipsel.trim())
    if (stelle !== -1) return text.slice(0, stelle).split('\n').length
  }

  return null
}

/**
 * subtotal + tax + tip + deposit − discounts should equal total. When it does
 * not, the preview shows a yellow bar and saving stays possible — an odd
 * receipt is still a receipt.
 */
function pruefeSumme(daten: ImportBelegDaten): string | null {
  if (daten.balanced === false) {
    return 'Der Bon geht laut Vorlage nicht auf. Prüf die Positionen.'
  }

  const erwartet = daten.subtotal + daten.tax + daten.tip + daten.deposit - daten.discounts
  if (daten.total === 0 || erwartet === 0) return null

  const abweichung = Math.abs(erwartet - daten.total)
  if (abweichung === 0) return null

  return `Die Positionen ergeben ${(erwartet / 100).toFixed(2).replace('.', ',')}, unten steht ${(daten.total / 100).toFixed(2).replace('.', ',')}.`
}

/** The prompt that gets copied, with the group's people and currency filled in. */
export function importPrompt(mitglieder: string[], basiswaehrung: string): string {
  return `Du bist ein Beleg-Parser. Lies den Kassenbon im Bild und gib
AUSSCHLIESSLICH gültiges JSON zurück. Kein Text davor oder
danach, keine Codefences, keine Erklärung.

Regeln:
- Alle Beträge als Ganzzahl in der kleinsten Währungseinheit
  (Cent). 3,49 EUR -> 349.
- Währung als ISO-4217-Code (EUR, USD, CHF, ...).
- Datum als YYYY-MM-DD. Nicht lesbar -> null.
- Rabatte als positive Zahl in "discounts".
- Pfand als eigene Zeile mit kind "deposit".
- Artikelnamen exakt wie auf dem Bon, zusaetzlich "name_clean"
  in verstaendlichem Deutsch.
- Es muss gelten: subtotal + tax + tip + deposit - discounts
  = total. Wenn nicht, setze "balanced": false.
- Fremdsprachige Bons: Namen im Original lassen, "name_clean"
  auf Deutsch.
- Nichts erfinden. Unleserlich -> "name": "?" und
  "confidence" niedrig.

Bekannte Personen dieser Gruppe: ${mitglieder.join(', ')}
Wenn aus dem Artikel klar hervorgeht, wem er gehoert, trage
sie in "suggested_for" ein, sonst leeres Array.

Schema:
{
  "schema": "quitt.receipt.v1",
  "merchant": string|null,
  "date": "YYYY-MM-DD"|null,
  "currency": "${basiswaehrung}",
  "items": [
    {"name": string, "name_clean": string, "qty": number,
     "unit_price": int|null, "total": int,
     "kind": "item"|"tax"|"tip"|"deposit"|"discount",
     "category": "lebensmittel"|"getraenke"|"haushalt"|
                 "drogerie"|"restaurant"|"transport"|
                 "freizeit"|"sonstiges",
     "suggested_for": [string]}
  ],
  "subtotal": int, "tax": int, "tip": int, "deposit": int,
  "discounts": int, "total": int,
  "balanced": boolean, "confidence": 0.0-1.0
}`
}

/** Normalises a category the model may have invented into one we know. */
export function kategorieAus(roh: string | null | undefined): string | null {
  if (!roh) return null
  const klein = roh.toLowerCase().trim()
  return (CATEGORIES as readonly string[]).includes(klein) ? klein : 'sonstiges'
}
