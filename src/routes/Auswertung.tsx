import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Rahmen } from '@/components/Rahmen'
import { Papier } from '@/components/Papier'
import { Knopf } from '@/components/Knopf'
import { Betrag } from '@/components/Betrag'
import { Zahlenrolle } from '@/components/Bewegung'
import { PersonChip } from '@/components/Person'
import { Skelett } from '@/components/Skelett'
import { Umschalter } from '@/components/Feld'
import { useAbrechnung, useSnapshot, zuCoreDaten } from '@/api/hooks'
import { auswerten, findeDuplikate, findeWiederkehrende } from '@/core/statistik'
import { belegeAlsCsv, dateiname, ladeHerunter, saldenAlsCsv } from '@/lib/export'
import { formatDate, formatMoney } from '@/lib/format'
import { CATEGORY_LABELS, type Category } from '@/shared/api'
import { KaroFlaeche, KategorieStempel, Perforation } from '@/components/PapierGrafik'

type Sicht = 'person' | 'kategorie' | 'monat'

export function Auswertung() {
  const { id = '' } = useParams()
  const { data, isLoading } = useSnapshot(id)
  const abrechnung = useAbrechnung(data)
  const [sicht, setSicht] = useState<Sicht>('person')

  const zahlen = useMemo(() => {
    if (!data) return null
    const { members, receipts } = zuCoreDaten(data)
    return {
      auswertung: auswerten(receipts, members, data.group.base_currency),
      duplikate: findeDuplikate(receipts),
      wiederkehrend: findeWiederkehrende(receipts),
    }
  }, [data])

  if (isLoading || !data || !zahlen) {
    return (
      <Rahmen titel="Auswertung" zurueck={`/g/${id}`}>
        <Papier className="p-6 mt-4">
          <Skelett zeilen={5} />
        </Papier>
      </Rahmen>
    )
  }

  const { group, members } = data
  const { auswertung, duplikate, wiederkehrend } = zahlen
  const waehrung = group.base_currency
  const maximum = groessterWert(auswertung, sicht)

  return (
    <Rahmen titel="Auswertung" zurueck={`/g/${id}`}>
      <Papier className="relative mt-3 overflow-hidden">
        <Perforation />
        <KaroFlaeche className="px-5 pt-6 pb-3">
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-[19px] font-medium">Insgesamt</h2>
            <span className="text-sm text-tinte-2">
              {auswertung.belegAnzahl} {auswertung.belegAnzahl === 1 ? 'Beleg' : 'Belege'}
            </span>
          </div>
          {/* The one place an amount moves: a single large total. It sits in
              its own boxed field, the way a result is boxed on a worksheet —
              texture never runs behind a figure. */}
          <div
            className="inline-flex items-baseline bg-karte rounded-klein px-3 py-1.5 mt-1"
            style={{ boxShadow: 'inset 0 0 0 1px var(--strich)' }}
          >
            <Zahlenrolle cents={auswertung.gesamtCents} currency={waehrung} />
          </div>
        </KaroFlaeche>
      </Papier>

      <Papier className="p-5 mt-3">
        <Umschalter
          label="Aufschlüsselung"
          wert={sicht}
          onWechsel={setSicht}
          className="mb-4"
          optionen={[
            { wert: 'person', text: 'Person' },
            { wert: 'kategorie', text: 'Kategorie' },
            { wert: 'monat', text: 'Monat' },
          ]}
        />

        {sicht === 'person' && (
          <ul>
            {members
              .filter((m) => !m.archived)
              .map((m) => {
                const verbraucht = auswertung.proPerson.get(m.id) ?? 0
                const gezahlt = auswertung.gezahltProPerson.get(m.id) ?? 0
                return (
                  <li key={m.id} className="py-3 trennstrich last:border-b-0 entfaltet">
                    <div className="flex items-center gap-3">
                      <PersonChip person={m} />
                      <span className="flex-1 font-bold truncate">{m.display_name}</span>
                      <Betrag cents={verbraucht} currency={waehrung} />
                    </div>
                    <Balken anteil={maximum > 0 ? verbraucht / maximum : 0} farbe={m.color} />
                    <p className="text-sm text-tinte-2 mt-1">
                      ausgelegt {formatMoney(gezahlt, waehrung)}
                    </p>
                  </li>
                )
              })}
          </ul>
        )}

        {sicht === 'kategorie' && (
          <ul>
            {[...auswertung.proKategorie.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([kategorie, cents]) => (
                <li key={kategorie} className="py-3 trennstrich last:border-b-0 entfaltet">
                  <div className="flex items-center gap-3">
                    <KategorieStempel kategorie={kategorie} className="text-tinte-2 shrink-0" />
                    <span className="flex-1 font-bold truncate">
                      {CATEGORY_LABELS[kategorie as Category] ?? kategorie}
                    </span>
                    <Betrag cents={cents} currency={waehrung} />
                  </div>
                  <Balken anteil={maximum > 0 ? cents / maximum : 0} farbe="var(--mint)" />
                </li>
              ))}
          </ul>
        )}

        {sicht === 'monat' && (
          <ul>
            {[...auswertung.proMonat.entries()]
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([monat, cents]) => (
                <li key={monat} className="py-3 trennstrich last:border-b-0 entfaltet">
                  <div className="flex items-center gap-3">
                    <span className="flex-1 font-bold font-mono tabular">{monatName(monat)}</span>
                    <Betrag cents={cents} currency={waehrung} />
                  </div>
                  <Balken anteil={maximum > 0 ? cents / maximum : 0} farbe="var(--lavendel)" />
                </li>
              ))}
          </ul>
        )}
      </Papier>

      {duplikate.length > 0 && (
        <Papier className="p-5 mt-3">
          <h2 className="text-[19px] font-medium mb-1">Sieht doppelt aus</h2>
          <p className="text-sm text-tinte-2 mb-3">
            Nur ein Hinweis. quitt fasst nichts von selbst zusammen.
          </p>
          <ul>
            {duplikate.slice(0, 8).map((d) => {
              const a = data.receipts.find((r) => r.id === d.a)
              const b = data.receipts.find((r) => r.id === d.b)
              if (!a || !b) return null
              return (
                <li key={`${d.a}-${d.b}`} className="py-3 trennstrich last:border-b-0">
                  <p className="text-sm text-tinte-2 mb-1.5">{d.grund}</p>
                  <div className="flex flex-wrap gap-2">
                    {[a, b].map((r) => (
                      <Link
                        key={r.id}
                        to={`/g/${id}/beleg/${r.id}`}
                        className="tap-ziel text-sm px-3 min-h-9 inline-flex items-center rounded-pille bg-papier border border-strich"
                      >
                        {r.merchant || 'Beleg'} · {formatDate(r.date)} ·{' '}
                        {formatMoney(r.total_cents, r.currency)}
                      </Link>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        </Papier>
      )}

      {wiederkehrend.length > 0 && (
        <Papier className="p-5 mt-3">
          <h2 className="text-[19px] font-medium mb-1">Kommt regelmäßig</h2>
          <p className="text-sm text-tinte-2 mb-3">Aus dem Verlauf abgeleitet.</p>
          <ul>
            {wiederkehrend.slice(0, 6).map((w) => (
              <li key={w.name} className="flex items-center gap-3 py-2.5 trennstrich last:border-b-0">
                <div className="flex-1 min-w-0">
                  <span className="font-bold block truncate">{w.name}</span>
                  <span className="text-sm text-tinte-2">
                    alle {w.abstandTage} Tage · zuletzt {formatDate(w.letztesDatum)}
                  </span>
                </div>
                <Betrag cents={w.betragCents} currency={w.currency} />
              </li>
            ))}
          </ul>
        </Papier>
      )}

      <Papier className="p-5 mt-3">
        <h2 className="text-[19px] font-medium mb-1">Export</h2>
        <p className="text-sm text-tinte-2 mb-3">
          CSV öffnet sich in jeder Tabellenkalkulation. Für ein PDF nimm den Druckdialog und wähl dort
          „Als PDF sichern".
        </p>
        <div className="flex flex-wrap gap-2">
          <Knopf
            art="zweit"
            onClick={() => ladeHerunter(belegeAlsCsv(data), dateiname(group.name, 'belege', 'csv'))}
          >
            Belege als CSV
          </Knopf>
          <Knopf
            art="zweit"
            onClick={() =>
              abrechnung &&
              ladeHerunter(
                saldenAlsCsv(data, abrechnung.balances, abrechnung.payments),
                dateiname(group.name, 'salden', 'csv'),
              )
            }
          >
            Salden als CSV
          </Knopf>
          <Knopf art="zweit" onClick={() => window.print()}>
            Drucken oder als PDF
          </Knopf>
        </div>
      </Papier>
    </Rahmen>
  )
}

/** A bar is a second channel for the same number, never the only one. */
function Balken({ anteil, farbe }: { anteil: number; farbe: string }) {
  return (
    <div
      aria-hidden="true"
      className="h-1.5 rounded-pille mt-2 overflow-hidden"
      style={{ background: 'var(--strich)' }}
    >
      <div
        className="h-full rounded-pille"
        style={{ width: `${Math.max(0, Math.min(100, anteil * 100))}%`, background: farbe }}
      />
    </div>
  )
}

function groessterWert(a: ReturnType<typeof auswerten>, sicht: Sicht): number {
  const werte =
    sicht === 'person'
      ? [...a.proPerson.values()]
      : sicht === 'kategorie'
        ? [...a.proKategorie.values()]
        : [...a.proMonat.values()]
  return werte.reduce((max, v) => Math.max(max, v), 0)
}

const MONATE = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' })

function monatName(iso: string): string {
  const [jahr, monat] = iso.split('-')
  if (!jahr || !monat) return iso
  return MONATE.format(new Date(Number(jahr), Number(monat) - 1, 1))
}
