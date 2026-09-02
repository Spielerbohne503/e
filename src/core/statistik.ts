import type { Member, Receipt } from './types'
import { allocateReceipt } from './allocate'
import { convertAmount } from './money'
import { decimalsFor } from './currency'

/**
 * Reporting. Everything here answers "where did the money go", which is a
 * different question from "who owes whom" — a person can carry a lot of
 * spend and still be square.
 */

export interface Auswertung {
  /** What each person consumed, not what they paid. */
  proPerson: Map<string, number>
  /** What each person fronted. */
  gezahltProPerson: Map<string, number>
  proKategorie: Map<string, number>
  /** Keyed by YYYY-MM. */
  proMonat: Map<string, number>
  gesamtCents: number
  belegAnzahl: number
}

export interface AuswertungsFilter {
  von?: string
  bis?: string
}

export function auswerten(
  receipts: Receipt[],
  members: Member[],
  baseCurrency: string,
  filter: AuswertungsFilter = {},
): Auswertung {
  const proPerson = new Map<string, number>()
  const gezahltProPerson = new Map<string, number>()
  const proKategorie = new Map<string, number>()
  const proMonat = new Map<string, number>()
  const baseDecimals = decimalsFor(baseCurrency)

  let gesamt = 0
  let anzahl = 0

  const dazu = (map: Map<string, number>, key: string, cents: number) =>
    map.set(key, (map.get(key) ?? 0) + cents)

  for (const receipt of receipts) {
    if (filter.von && (!receipt.date || receipt.date < filter.von)) continue
    if (filter.bis && (!receipt.date || receipt.date > filter.bis)) continue

    const decimals = decimalsFor(receipt.currency)
    const um = (cents: number) => convertAmount(cents, receipt.fxRateToBase, decimals, baseDecimals)

    anzahl++
    gesamt += um(receipt.totalCents)
    dazu(gezahltProPerson, receipt.payerId, um(receipt.totalCents))

    for (const [memberId, cents] of allocateReceipt(receipt, members)) {
      dazu(proPerson, memberId, um(cents))
    }

    for (const item of receipt.items) {
      dazu(proKategorie, item.category ?? 'sonstiges', um(item.totalCents))
    }

    if (receipt.date) dazu(proMonat, receipt.date.slice(0, 7), um(receipt.totalCents))
  }

  return { proPerson, gezahltProPerson, proKategorie, proMonat, gesamtCents: gesamt, belegAnzahl: anzahl }
}

/* ------------------------------------------------------------------ *
 * Duplicate detection
 * ------------------------------------------------------------------ */

export interface Duplikat {
  a: string
  b: string
  grund: string
}

/**
 * Finds receipts that look like the same one entered twice: same payer, same
 * amount, and dates within three days. Same merchant makes it near certain,
 * but a nameless receipt still counts when everything else lines up.
 *
 * Only ever a hint — nothing is merged or deleted automatically.
 */
export function findeDuplikate(receipts: Receipt[]): Duplikat[] {
  const treffer: Duplikat[] = []

  for (let i = 0; i < receipts.length; i++) {
    for (let j = i + 1; j < receipts.length; j++) {
      const a = receipts[i]!
      const b = receipts[j]!

      if (a.payerId !== b.payerId) continue
      if (a.totalCents !== b.totalCents || a.currency !== b.currency) continue
      if (a.totalCents === 0) continue

      const tage = tageZwischen(a.date, b.date)
      if (tage === null || tage > 3) continue

      const gleicherLaden =
        a.items.length > 0 &&
        b.items.length > 0 &&
        normalisiere(a.items[0]!.name) === normalisiere(b.items[0]!.name)

      treffer.push({
        a: a.id,
        b: b.id,
        grund: gleicherLaden
          ? 'Gleicher Betrag, gleicher Zahler, gleiche erste Position'
          : 'Gleicher Betrag, gleicher Zahler, fast gleiches Datum',
      })
    }
  }

  return treffer
}

function tageZwischen(a: string | null, b: string | null): number | null {
  if (!a || !b) return null
  const ms = Math.abs(new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime())
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : null
}

/* ------------------------------------------------------------------ *
 * Learning assignments from history
 * ------------------------------------------------------------------ */

/**
 * Strips quantities, units and punctuation so "Milch 1L" matches "MILCH".
 *
 * Umlauts are transliterated because a till prints "MUESLI" where the
 * readable name says "Müsli" — without this, the same article would never
 * match itself across an import.
 */
function normalisiere(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\d+([.,]\d+)?\s*(g|kg|ml|l|stk|st|x)?\b/g, ' ')
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface Zuordnungsvorschlag {
  memberIds: string[]
  /** How many past receipts back this up. */
  belege: number
}

/**
 * Suggests who a line belongs to, based on how the same article was assigned
 * before. Only suggests when the history is unambiguous enough to be useful:
 * at least two past occurrences that agreed.
 */
export function baueVorschlaege(receipts: Receipt[]): Map<string, Zuordnungsvorschlag> {
  // article -> serialised member set -> count
  const historie = new Map<string, Map<string, number>>()

  for (const receipt of receipts) {
    for (const item of receipt.items) {
      if (item.kind !== 'item' || item.splits.length === 0) continue

      const artikel = normalisiere(item.name)
      if (artikel.length < 3) continue

      const satz = [...new Set(item.splits.map((s) => s.memberId))].sort().join(',')
      let zaehler = historie.get(artikel)
      if (!zaehler) {
        zaehler = new Map()
        historie.set(artikel, zaehler)
      }
      zaehler.set(satz, (zaehler.get(satz) ?? 0) + 1)
    }
  }

  const vorschlaege = new Map<string, Zuordnungsvorschlag>()

  for (const [artikel, zaehler] of historie) {
    const sortiert = [...zaehler.entries()].sort((a, b) => b[1] - a[1])
    const [besterSatz, anzahl] = sortiert[0]!

    // One sighting is a coincidence, not a habit.
    if (anzahl < 2) continue

    vorschlaege.set(artikel, { memberIds: besterSatz.split(','), belege: anzahl })
  }

  return vorschlaege
}

/** Looks up a suggestion for one article name. */
export function vorschlagFuer(
  vorschlaege: Map<string, Zuordnungsvorschlag>,
  name: string,
): Zuordnungsvorschlag | null {
  return vorschlaege.get(normalisiere(name)) ?? null
}

/* ------------------------------------------------------------------ *
 * Recurring costs
 * ------------------------------------------------------------------ */

export interface WiederkehrenderPosten {
  name: string
  /** Median amount across sightings, in the receipt's currency. */
  betragCents: number
  currency: string
  /** Roughly how many days between sightings. */
  abstandTage: number
  letztesDatum: string
  belege: number
}

/**
 * Spots costs that come back on a rhythm — rent, a subscription, the weekly
 * shop at the same place. Needs at least three sightings to call it a rhythm.
 */
export function findeWiederkehrende(receipts: Receipt[]): WiederkehrenderPosten[] {
  const nachName = new Map<string, Receipt[]>()

  for (const receipt of receipts) {
    if (!receipt.date || !receipt.merchant) continue
    const key = normalisiere(receipt.merchant)
    if (key.length < 3) continue
    const liste = nachName.get(key)
    if (liste) liste.push(receipt)
    else nachName.set(key, [receipt])
  }

  const ergebnis: WiederkehrenderPosten[] = []

  for (const [, belege] of nachName) {
    if (belege.length < 3) continue

    const sortiert = [...belege].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    const abstaende: number[] = []
    for (let i = 1; i < sortiert.length; i++) {
      const tage = tageZwischen(sortiert[i - 1]!.date, sortiert[i]!.date)
      if (tage !== null) abstaende.push(tage)
    }
    if (abstaende.length === 0) continue

    const betraege = sortiert.map((r) => r.totalCents).sort((a, b) => a - b)
    const letzter = sortiert[sortiert.length - 1]!

    ergebnis.push({
      name: letzter.merchant ?? '',
      betragCents: betraege[Math.floor(betraege.length / 2)]!,
      currency: letzter.currency,
      abstandTage: Math.round(abstaende.reduce((a, b) => a + b, 0) / abstaende.length),
      letztesDatum: letzter.date ?? '',
      belege: sortiert.length,
    })
  }

  return ergebnis.sort((a, b) => b.belege - a.belege)
}
