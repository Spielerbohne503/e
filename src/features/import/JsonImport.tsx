import { useState } from 'react'
import type { Snapshot } from '@/shared/api'
import { Papier } from '@/components/Papier'
import { Knopf } from '@/components/Knopf'
import { Zetti } from '@/components/Zetti'
import { Haken } from '@/components/Stempel'
import { importPrompt, kategorieAus, parseImport, type ImportBelegDaten } from './parser'
import {
  leerePosition,
  neuerSchluessel,
  textFuer,
  type BelegEntwurf,
  type EntwurfPosition,
} from '@/features/beleg/entwurf'
import { today } from '@/lib/format'

/**
 * The manual import route: copy a prompt, paste it into a chat assistant
 * along with the photo, paste the answer back here. No vision API in the
 * backend, no key, no image ever leaving the device through us.
 */
export function JsonImport({
  snapshot,
  onUebernehmen,
}: {
  snapshot: Snapshot
  onUebernehmen: (entwurf: BelegEntwurf) => void
}) {
  const [text, setText] = useState('')
  const [fehler, setFehler] = useState<{ nachricht: string; zeile: number | null } | null>(null)
  const [kopiert, setKopiert] = useState(false)

  const mitglieder = snapshot.members.filter((m) => !m.archived)
  const prompt = importPrompt(
    mitglieder.map((m) => m.display_name),
    snapshot.group.base_currency,
  )

  const promptKopieren = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setKopiert(true)
      setTimeout(() => setKopiert(false), 2000)
    } catch {
      setFehler({ nachricht: 'Kopieren ging nicht. Markier den Text und kopier ihn selbst.', zeile: null })
    }
  }

  const ausZwischenablage = async () => {
    try {
      setText(await navigator.clipboard.readText())
      setFehler(null)
    } catch {
      setFehler({ nachricht: 'Einfügen ging nicht. Füg den Text selbst ein.', zeile: null })
    }
  }

  const einlesen = () => {
    const ergebnis = parseImport(text)
    if (!ergebnis.ok) {
      setFehler({ nachricht: ergebnis.nachricht, zeile: ergebnis.zeile })
      return
    }
    setFehler(null)
    onUebernehmen(zuEntwurf(ergebnis.daten, snapshot, ergebnis.warnung))
  }

  return (
    <>
      <Papier className="p-5 mt-3">
        <h2 className="text-[19px] font-medium mb-1">So geht es</h2>
        <ol className="text-sm text-tinte-2 grid gap-1.5 mb-4 pl-5 list-decimal">
          <li>Prompt kopieren</li>
          <li>Prompt und Foto des Bons in ChatGPT oder Claude einfügen</li>
          <li>Antwort zurück hierher kopieren</li>
        </ol>

        <div className="flex flex-wrap items-center gap-3">
          <Knopf onClick={promptKopieren}>{kopiert ? 'Kopiert' : 'Prompt kopieren'}</Knopf>
          {/* Confirmations draw themselves rather than popping in. */}
          {kopiert && <Haken groesse={32} />}
        </div>
      </Papier>

      <Papier className="p-5 mt-3">
        <label htmlFor="json-feld" className="block text-sm font-bold mb-1.5">
          JSON einfügen
        </label>
        <textarea
          id="json-feld"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setFehler(null)
          }}
          placeholder='{"schema": "quitt.receipt.v1", …}'
          className="w-full min-h-40 px-3.5 py-2.5 rounded-klein bg-papier border border-strich focus:border-lavendel font-mono text-sm resize-y"
        />

        <div className="flex flex-wrap gap-2 mt-3">
          <Knopf art="zweit" onClick={ausZwischenablage}>
            Aus Zwischenablage einfügen
          </Knopf>
          <Knopf onClick={einlesen} disabled={!text.trim()}>
            Einlesen
          </Knopf>
        </div>
      </Papier>

      {fehler && (
        <Papier className="p-5 mt-3 flex gap-4 items-start">
          {snapshot.group.show_zetti === 1 && <Zetti groesse={64} />}
          <div className="flex-1">
            <p className="font-bold text-fehler">{fehler.nachricht}</p>
            {fehler.zeile !== null && (
              <p className="text-sm text-tinte-2 mt-1 font-mono tabular">Zeile {fehler.zeile}</p>
            )}
            <p className="text-sm text-tinte-2 mt-2">
              Du kannst den Beleg auch von Hand erfassen.
            </p>
          </div>
        </Papier>
      )}
    </>
  )
}

/**
 * Turns parsed import data into an editable draft.
 *
 * The summary fields (tax, tip, deposit, discounts) only become their own
 * lines when the item list does not already contain them — some models put
 * them in both places, and counting them twice would inflate the receipt.
 */
function zuEntwurf(daten: ImportBelegDaten, snapshot: Snapshot, warnung: string | null): BelegEntwurf {
  const currency = daten.currency
  const mitglieder = snapshot.members.filter((m) => !m.archived)

  const positionen: EntwurfPosition[] = daten.items.map((item) => {
    const kind = item.kind ?? 'item'
    // A discount is stored negative so the lines add up to the total.
    const betrag = kind === 'discount' ? -Math.abs(item.total) : item.total

    // The model may have recognised whose item it is; pre-assign when the
    // name matches a person in this group, otherwise leave it open.
    const vorschlag = (item.suggested_for ?? [])
      .map((name) => mitglieder.find((m) => m.display_name.toLowerCase() === name.toLowerCase()))
      .filter((m): m is (typeof mitglieder)[number] => Boolean(m))

    return {
      key: neuerSchluessel(),
      name: item.name_clean?.trim() || item.name,
      nameOriginal: item.name_clean && item.name !== item.name_clean ? item.name : null,
      betragText: textFuer(betrag, currency),
      totalCents: betrag,
      qty: typeof item.qty === 'number' ? item.qty : Number(String(item.qty ?? 1).replace(',', '.')) || 1,
      kind,
      category: kategorieAus(item.category),
      splits: vorschlag.map((m) => ({ memberId: m.id, mode: 'equal' as const, value: 1 })),
    }
  })

  const hat = (kind: string) => daten.items.some((i) => (i.kind ?? 'item') === kind)

  const zusatz: Array<[string, string, number, EntwurfPosition['kind']]> = [
    ['tax', 'Steuer', daten.tax, 'tax'],
    ['tip', 'Trinkgeld', daten.tip, 'tip'],
    ['deposit', 'Pfand', daten.deposit, 'deposit'],
    ['discount', 'Rabatt', -daten.discounts, 'discount'],
  ]

  for (const [schluessel, name, betrag, kind] of zusatz) {
    if (betrag === 0 || hat(schluessel)) continue
    positionen.push({
      ...leerePosition(kind),
      name,
      betragText: textFuer(Math.abs(betrag), currency),
      totalCents: betrag,
    })
  }

  return {
    merchant: daten.merchant ?? '',
    date: daten.date ?? today(),
    note: warnung ?? '',
    payerId: mitglieder[0]?.id ?? '',
    currency,
    fxRateToBase: 1,
    fxDate: today(),
    summeText: textFuer(daten.total, currency),
    totalCents: daten.total,
    source: 'import',
    rawJson: JSON.stringify(daten),
    positionen: positionen.length > 0 ? positionen : [leerePosition()],
  }
}
