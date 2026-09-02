import { useEffect, useMemo, useRef, useState } from 'react'
import type { Budget, Snapshot } from '@/shared/api'
import { budgetProPerson, budgetStand, type BudgetDefinition } from '@/core/budget'
import { zuCoreDaten } from '@/api/hooks'
import { formatDate, formatMoney, today } from '@/lib/format'
import { Sheet } from '@/components/Sheet'
import { PersonChip } from '@/components/Person'
import { Betrag } from '@/components/Betrag'
import { Knopf } from '@/components/Knopf'
import { useBudgetLoeschen } from '@/api/hooks'

export function alsDefinition(budget: Budget): BudgetDefinition {
  return {
    amountCents: budget.amount_cents,
    currency: budget.currency,
    period: budget.period,
    startsOn: budget.starts_on,
    endsOn: budget.ends_on,
    categories: budget.categories ? (JSON.parse(budget.categories) as string[]) : null,
  }
}

const STUFEN_FARBE = {
  ruhig: 'var(--mint)',
  knapp: 'var(--bon)',
  drueber: 'var(--koralle)',
} as const

/**
 * The sticky budget bar. It only exists when a budget does — no empty
 * placeholder, no greyed-out area.
 *
 * Crossing a threshold shakes the bar once. Not on every render, only when
 * the level actually changes.
 */
export function BudgetLeiste({
  gruppeId,
  snapshot,
  budget,
}: {
  gruppeId: string
  snapshot: Snapshot
  budget: Budget
}) {
  const [offen, setOffen] = useState(false)
  const [zittert, setZittert] = useState(false)
  const vorigeStufe = useRef<string | null>(null)

  const definition = useMemo(() => alsDefinition(budget), [budget])
  const stand = useMemo(() => {
    const { receipts } = zuCoreDaten(snapshot)
    return budgetStand(receipts, definition, snapshot.group.base_currency, today())
  }, [snapshot, definition])

  useEffect(() => {
    if (vorigeStufe.current !== null && vorigeStufe.current !== stand.stufe) {
      setZittert(true)
      const t = setTimeout(() => setZittert(false), 440)
      return () => clearTimeout(t)
    }
    vorigeStufe.current = stand.stufe
    return
  }, [stand.stufe])

  const prozent = Math.min(100, Math.max(0, stand.anteil * 100))
  const waehrung = snapshot.group.base_currency
  const drueber = stand.restCents < 0

  return (
    <>
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="w-full px-4 pb-2.5 text-left"
        aria-label={`Budget: ${formatMoney(stand.ausgegebenCents, waehrung)} von ${formatMoney(stand.budgetCents, waehrung)}. Antippen für Details`}
      >
        <div className="mx-auto max-w-[680px]">
          <div className="flex justify-between font-mono tabular text-[13px] mb-2">
            <span>
              {formatMoney(stand.ausgegebenCents, waehrung)} von {formatMoney(stand.budgetCents, waehrung)}
            </span>
            <span className={drueber ? 'text-koralle font-medium' : ''}>
              {drueber
                ? `+${formatMoney(-stand.restCents, waehrung)} drüber`
                : `noch ${formatMoney(stand.restCents, waehrung)}`}
            </span>
          </div>
          <div
            className="h-3.5 rounded-pille overflow-hidden"
            style={{
              background: 'var(--strich)',
              animation: zittert ? 'zittern 420ms ease-in-out' : undefined,
            }}
          >
            <div
              className="h-full rounded-pille"
              style={{
                width: `${prozent}%`,
                background: STUFEN_FARBE[stand.stufe],
                transition: 'width 900ms var(--ease-zack), background-color 300ms linear',
              }}
            />
          </div>
        </div>
      </button>

      <BudgetSheet
        offen={offen}
        onSchliessen={() => setOffen(false)}
        gruppeId={gruppeId}
        snapshot={snapshot}
        budget={budget}
      />
    </>
  )
}

function BudgetSheet({
  offen,
  onSchliessen,
  gruppeId,
  snapshot,
  budget,
}: {
  offen: boolean
  onSchliessen: () => void
  gruppeId: string
  snapshot: Snapshot
  budget: Budget
}) {
  const loeschen = useBudgetLoeschen(gruppeId)
  const definition = useMemo(() => alsDefinition(budget), [budget])
  const waehrung = snapshot.group.base_currency

  const { stand, proPerson } = useMemo(() => {
    const { receipts } = zuCoreDaten(snapshot)
    const s = budgetStand(receipts, definition, waehrung, today())
    return { stand: s, proPerson: budgetProPerson(receipts, definition, waehrung, s.zeitraum) }
  }, [snapshot, definition, waehrung])

  const sortiert = [...proPerson.entries()].sort((a, b) => b[1] - a[1])

  return (
    <Sheet offen={offen} titel="Budget" onSchliessen={onSchliessen}>
      <p className="font-mono tabular text-sm text-tinte-2 mb-4">
        {formatDate(stand.zeitraum.von)} bis {formatDate(stand.zeitraum.bis)}
      </p>

      <div className="flex items-baseline gap-2 mb-1">
        <Betrag cents={stand.ausgegebenCents} currency={waehrung} gross />
        <span className="text-tinte-2">von {formatMoney(stand.budgetCents, waehrung)}</span>
      </div>

      {stand.leerAm && (
        <p className="text-sm text-tinte-2 mb-4">
          Bei dem Tempo am {formatDate(stand.leerAm)} leer.
        </p>
      )}

      {sortiert.length > 0 && (
        <>
          <h3 className="text-[17px] font-medium mt-5 mb-1">Wer ausgelegt hat</h3>
          <p className="text-sm text-tinte-2 mb-2">
            Fürs Budget zählt die Ausgabe, nicht wer sie am Ende trägt.
          </p>
          <ul className="mb-4">
            {sortiert.map(([memberId, cents]) => {
              const person = snapshot.members.find((m) => m.id === memberId)
              if (!person) return null
              return (
                <li key={memberId} className="flex items-center gap-3 py-2.5 trennstrich last:border-b-0">
                  <PersonChip person={person} />
                  <span className="flex-1 font-bold truncate">{person.display_name}</span>
                  <Betrag cents={cents} currency={waehrung} />
                </li>
              )
            })}
          </ul>
        </>
      )}

      <Knopf
        art="gefahr"
        breit
        className="mb-2"
        onClick={() => {
          loeschen.mutate(budget.id, { onSuccess: onSchliessen })
        }}
      >
        Budget löschen
      </Knopf>
    </Sheet>
  )
}
