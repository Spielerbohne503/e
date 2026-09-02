import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Snapshot } from '@/shared/api'
import {
  buildTravelItems,
  computeTravel,
  DEFAULT_RATE_CENTS,
  RATE_PRESETS,
  travelLineName,
  type ExtraCost,
  type TravelSnapshot,
} from '@/core/travel'
import { Papier, Bon, Handnotiz } from '@/components/Papier'
import { Knopf, IkonKnopf } from '@/components/Knopf'
import { Feld, Auswahl, Schalter, Umschalter } from '@/components/Feld'
import { PersonChip } from '@/components/Person'
import { Betrag } from '@/components/Betrag'
import { formatKm, formatMoney, parseAmount, today } from '@/lib/format'
import { useBelegSpeichern } from '@/api/hooks'

/**
 * Fahrtkosten-Rechner.
 *
 * Deliberately not a separate kind of expense: this form only computes the
 * numbers and then saves an ordinary receipt with category 'transport'. The
 * trip therefore flows through splitting, balances, netting, budget and
 * export with no special case anywhere downstream.
 *
 * The driver is the payer. Passengers are whoever carries the cost — normally
 * including the driver, but they can take themselves out when the point is
 * that the others chip in for the fuel.
 */
export function FahrtRechner({
  gruppeId,
  snapshot,
  vorlage,
  belegId,
}: {
  gruppeId: string
  snapshot: Snapshot
  vorlage?: TravelSnapshot
  belegId?: string
}) {
  const navigate = useNavigate()
  const speichern = useBelegSpeichern(gruppeId)
  const mitglieder = snapshot.members.filter((m) => !m.archived)

  const [von, setVon] = useState(vorlage?.from ?? '')
  const [nach, setNach] = useState(vorlage?.to ?? '')
  const [datum, setDatum] = useState(today())
  const [strecke, setStrecke] = useState(vorlage ? String(vorlage.distanceKm).replace('.', ',') : '')
  const [hinUndZurueck, setHinUndZurueck] = useState(vorlage?.roundTrip ?? true)
  const [satzText, setSatzText] = useState(
    ((vorlage?.ratePerKmCents ?? DEFAULT_RATE_CENTS) / 100).toFixed(2).replace('.', ','),
  )
  const [extras, setExtras] = useState<ExtraCost[]>(vorlage?.extras ?? [])
  const [fahrerId, setFahrerId] = useState(vorlage?.passengerIds?.[0] ?? mitglieder[0]?.id ?? '')
  const [mitfahrer, setMitfahrer] = useState<string[]>(
    vorlage?.passengerIds ?? mitglieder.map((m) => m.id),
  )
  const [modus, setModus] = useState<'equal' | 'shares'>(vorlage?.splitMode ?? 'equal')
  const [anteile, setAnteile] = useState<Record<string, number>>(vorlage?.shares ?? {})
  const [fehler, setFehler] = useState<string | null>(null)

  const km = Number(strecke.replace(',', '.')) || 0
  const satzCents = parseAmount(satzText, snapshot.group.base_currency) ?? DEFAULT_RATE_CENTS

  const eingabe = useMemo(
    () => ({
      distanceKm: km,
      roundTrip: hinUndZurueck,
      ratePerKmCents: satzCents,
      extras: extras.filter((e) => e.cents > 0),
    }),
    [km, hinUndZurueck, satzCents, extras],
  )

  const ergebnis = useMemo(() => computeTravel(eingabe), [eingabe])

  // The preview runs through the very same core function as the save,
  // so the two can never disagree.
  const positionen = useMemo(
    () =>
      buildTravelItems({
        ...eingabe,
        passengerIds: mitfahrer,
        splitMode: modus,
        shares: anteile,
      }),
    [eingabe, mitfahrer, modus, anteile],
  )

  const proPerson = useMemo(() => {
    const summe = new Map<string, number>()
    for (const item of positionen) {
      const gewichte = mitfahrer.map((id) => (modus === 'shares' ? (anteile[id] ?? 1) : 1))
      const gesamt = gewichte.reduce((a, b) => a + b, 0) || 1
      mitfahrer.forEach((id, i) => {
        summe.set(id, (summe.get(id) ?? 0) + Math.round((item.totalCents * gewichte[i]!) / gesamt))
      })
    }
    return summe
  }, [positionen, mitfahrer, modus, anteile])

  const umschalten = (id: string) => {
    setMitfahrer((alt) => (alt.includes(id) ? alt.filter((x) => x !== id) : [...alt, id]))
  }

  const kannSpeichern = km > 0 && fahrerId !== '' && mitfahrer.length > 0

  const absenden = () => {
    setFehler(null)

    // Everything needed to reopen this form exactly as it was.
    const zustand: TravelSnapshot = {
      ...eingabe,
      passengerIds: mitfahrer,
      splitMode: modus,
      shares: modus === 'shares' ? anteile : undefined,
      from: von || undefined,
      to: nach || undefined,
    }

    const bezeichnung = von && nach ? `${von} – ${nach}` : von || nach || 'Fahrt'

    speichern.mutate(
      {
        id: belegId,
        body: {
          payer_id: fahrerId,
          merchant: bezeichnung,
          date: datum || null,
          note: null,
          currency: snapshot.group.base_currency,
          fx_rate_to_base: 1,
          fx_date: today(),
          total_cents: ergebnis.totalCents,
          source: 'travel' as const,
          raw_json: JSON.stringify(zustand),
          items: positionen.map((p, i) => ({
            name: p.name,
            name_original: null,
            qty: p.qty,
            total_cents: p.totalCents,
            kind: p.kind,
            category: p.category,
            sort_order: i,
            splits: p.splits.map((s) => ({
              member_id: s.memberId,
              mode: s.mode,
              value: s.value,
            })),
          })),
        },
      },
      {
        onSuccess: () => navigate(`/g/${gruppeId}`),
        onError: (e) => setFehler(e instanceof Error ? e.message : 'Speichern ging nicht'),
      },
    )
  }

  return (
    <>
      <Papier className="p-5 mt-3">
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Feld label="Von" value={von} onChange={(e) => setVon(e.target.value)} placeholder="München" />
            <Feld label="Nach" value={nach} onChange={(e) => setNach(e.target.value)} placeholder="Berlin" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Feld
              label="Strecke"
              value={strecke}
              onChange={(e) => setStrecke(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              mono
              hinweis={hinUndZurueck ? 'Einfache Strecke' : 'Gesamte Strecke'}
            />
            <Feld
              label="Datum"
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              mono
            />
          </div>

          <Schalter
            label="Hin und zurück"
            beschreibung="Verdoppelt die Strecke"
            an={hinUndZurueck}
            onWechsel={setHinUndZurueck}
          />

          <div>
            <Feld
              label="Satz pro Kilometer"
              value={satzText}
              onChange={(e) => setSatzText(e.target.value)}
              inputMode="decimal"
              mono
              hinweis="Übliche Pauschalen, frei änderbar."
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {RATE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setSatzText((p.ratePerKmCents / 100).toFixed(2).replace('.', ','))}
                  aria-pressed={satzCents === p.ratePerKmCents}
                  className={`tap-ziel min-h-9 px-3 rounded-pille text-sm border transition-colors duration-[--dauer-tipp] ${
                    satzCents === p.ratePerKmCents
                      ? 'bg-knopf text-knopf-tinte border-transparent'
                      : 'bg-papier border-strich text-tinte-2'
                  }`}
                >
                  {p.label} · {p.hint}
                </button>
              ))}
            </div>
          </div>

          <Auswahl label="Wer ist gefahren?" value={fahrerId} onChange={(e) => setFahrerId(e.target.value)}>
            {mitglieder.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
              </option>
            ))}
          </Auswahl>
        </div>
      </Papier>

      <Papier className="p-5 mt-3">
        <h2 className="text-[19px] font-medium mb-1">Zusatzkosten</h2>
        <p className="text-sm text-tinte-2 mb-3">Maut, Parken, Fähre, Sprit — alles, was noch dazukam.</p>

        {extras.length > 0 && (
          <ul className="grid gap-2 mb-3">
            {extras.map((e, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  value={e.label}
                  onChange={(ev) =>
                    setExtras((alt) => alt.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)))
                  }
                  placeholder="Maut"
                  aria-label={`Bezeichnung der ${i + 1}. Zusatzkosten`}
                  className="flex-1 min-w-0 min-h-11 px-2.5 rounded-klein bg-papier border border-strich focus:border-lavendel"
                />
                <input
                  value={e.cents === 0 ? '' : (e.cents / 100).toFixed(2).replace('.', ',')}
                  onChange={(ev) =>
                    setExtras((alt) =>
                      alt.map((x, j) =>
                        j === i
                          ? { ...x, cents: parseAmount(ev.target.value, snapshot.group.base_currency) ?? 0 }
                          : x,
                      ),
                    )
                  }
                  inputMode="decimal"
                  placeholder="0,00"
                  aria-label={`Betrag der ${i + 1}. Zusatzkosten`}
                  className="w-24 shrink-0 min-h-11 px-2 text-right font-mono tabular rounded-klein bg-papier border border-strich focus:border-lavendel"
                />
                <IkonKnopf
                  label={`${e.label || 'Zusatzkosten'} entfernen`}
                  onClick={() => setExtras((alt) => alt.filter((_, j) => j !== i))}
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </IkonKnopf>
              </li>
            ))}
          </ul>
        )}

        <Knopf art="geist" className="-ml-1" onClick={() => setExtras((alt) => [...alt, { label: '', cents: 0 }])}>
          + Zusatzkosten
        </Knopf>
      </Papier>

      <Papier className="p-5 mt-3">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="text-[19px] font-medium">Wer fährt mit?</h2>
          <Umschalter
            label="Aufteilung"
            wert={modus}
            onWechsel={setModus}
            optionen={[
              { wert: 'equal', text: 'Gleich' },
              { wert: 'shares', text: 'Anteile' },
            ]}
          />
        </div>
        <p className="text-sm text-tinte-2 mb-3">
          {modus === 'equal'
            ? 'Der Fahrer kann sich herausnehmen, dann zahlen nur die Mitfahrer.'
            : 'Anteile, etwa für jemanden, der nur die halbe Strecke mitfährt.'}
        </p>

        <div className="flex flex-wrap gap-2.5 mb-3">
          {mitglieder.map((m) => (
            <PersonChip
              key={m.id}
              person={m}
              aktiv={mitfahrer.includes(m.id)}
              onClick={() => umschalten(m.id)}
              gross
            />
          ))}
        </div>

        {modus === 'shares' && mitfahrer.length > 0 && (
          <ul className="mb-2">
            {mitfahrer.map((id) => {
              const person = mitglieder.find((m) => m.id === id)
              if (!person) return null
              return (
                <li key={id} className="flex items-center gap-3 py-2 trennstrich last:border-b-0">
                  <PersonChip person={person} />
                  <span className="flex-1 truncate font-bold">{person.display_name}</span>
                  <input
                    inputMode="decimal"
                    value={String(anteile[id] ?? 1)}
                    onChange={(e) =>
                      setAnteile((alt) => ({ ...alt, [id]: Number(e.target.value.replace(',', '.')) || 0 }))
                    }
                    aria-label={`Anteile für ${person.display_name}`}
                    className="w-20 min-h-11 px-2 text-right font-mono tabular rounded-klein bg-papier border border-strich focus:border-lavendel"
                  />
                </li>
              )
            })}
          </ul>
        )}
      </Papier>

      {/* The result, on a bon strip like every other line item list. */}
      {km > 0 && (
        <Bon className="mt-4">
          <div className="px-5 pt-5">
            <h2 className="text-[19px] font-medium mb-3">Das kostet die Fahrt</h2>
            <ul>
              <li className="flex items-center gap-3 py-2.5 trennstrich">
                <span className="flex-1">{travelLineName(ergebnis, satzCents)}</span>
                <Betrag cents={ergebnis.distanceCents} currency={snapshot.group.base_currency} />
              </li>
              {extras
                .filter((e) => e.cents > 0)
                .map((e, i) => (
                  <li key={i} className="flex items-center gap-3 py-2.5 trennstrich">
                    <span className="flex-1">{e.label || 'Zusatzkosten'}</span>
                    <Betrag cents={e.cents} currency={snapshot.group.base_currency} />
                  </li>
                ))}
              <li className="flex items-center gap-3 py-3">
                <span className="flex-1 font-bold">Gesamt</span>
                <Betrag
                  cents={ergebnis.totalCents}
                  currency={snapshot.group.base_currency}
                  className="text-[22px]"
                />
              </li>
            </ul>
          </div>

          {mitfahrer.length > 0 && (
            <div className="px-5 pb-6">
              <h3 className="text-[17px] font-medium mt-2 mb-1">Pro Person</h3>
              <ul>
                {mitfahrer.map((id) => {
                  const person = mitglieder.find((m) => m.id === id)
                  if (!person) return null
                  return (
                    <li key={id} className="flex items-center gap-3 py-2 trennstrich last:border-b-0">
                      <PersonChip person={person} />
                      <span className="flex-1 truncate">{person.display_name}</span>
                      <Betrag cents={proPerson.get(id) ?? 0} currency={snapshot.group.base_currency} />
                    </li>
                  )
                })}
              </ul>

              <Handnotiz className="mt-4">
                {formatKm(ergebnis.totalDistanceKm)} zu {formatMoney(satzCents, snapshot.group.base_currency)} je km
              </Handnotiz>
            </div>
          )}
        </Bon>
      )}

      {fehler && (
        <p className="mt-3 rounded-karte bg-fehler-weich text-fehler px-4 py-3" role="alert">
          {fehler}
        </p>
      )}

      <Knopf breit onClick={absenden} disabled={!kannSpeichern || speichern.isPending} className="mt-4">
        {speichern.isPending ? 'Wird gespeichert' : 'Fahrt speichern'}
      </Knopf>
    </>
  )
}
