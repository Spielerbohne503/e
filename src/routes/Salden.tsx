import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Rahmen } from '@/components/Rahmen'
import { Papier } from '@/components/Papier'
import { Knopf } from '@/components/Knopf'
import { Betrag, Saldo } from '@/components/Betrag'
import { PersonChip } from '@/components/Person'
import { QuittStempel } from '@/components/Stempel'
import { Zetti } from '@/components/Zetti'
import { Skelett } from '@/components/Skelett'
import { useAbrechnung, useAusgleichAnlegen, useAusgleichLoeschen, useSnapshot } from '@/api/hooks'
import { formatDate, formatMoney } from '@/lib/format'
import type { Payment } from '@/core/types'

/**
 * Balances and the payments that clear them.
 *
 * The one celebration in the app lives here: when every balance is zero, the
 * quitt stamp lands with confetti. Exactly once per settlement — a ref makes
 * sure a re-render does not fire it again.
 */
export function Salden() {
  const { id = '' } = useParams()
  const { data, isLoading } = useSnapshot(id)
  const abrechnung = useAbrechnung(data)
  const ausgleichen = useAusgleichAnlegen(id)
  const ausgleichZurueck = useAusgleichLoeschen(id)
  const [fliegt, setFliegt] = useState<string | null>(null)

  if (isLoading || !data || !abrechnung) {
    return (
      <Rahmen titel="Stand" zurueck={`/g/${id}`}>
        <Papier className="p-6 mt-4">
          <Skelett zeilen={4} />
        </Papier>
      </Rahmen>
    )
  }

  const { group, members, settlements } = data
  const aktive = members.filter((m) => !m.archived)
  const person = (mid: string) => members.find((m) => m.id === mid)

  const zahlungMarkieren = (zahlung: Payment) => {
    // Let the coin fly first, then write. The animation is 760ms; the request
    // usually lands sooner, and the list only changes once it has.
    setFliegt(`${zahlung.fromId}-${zahlung.toId}`)
    setTimeout(() => setFliegt(null), 800)

    ausgleichen.mutate({
      from_id: zahlung.fromId,
      to_id: zahlung.toId,
      amount_cents: zahlung.amountCents,
    })
  }

  return (
    <Rahmen titel="Stand" zurueck={`/g/${id}`}>
      {abrechnung.quitt ? (
        <QuittMoment zettiAn={group.show_zetti === 1} />
      ) : (
        <>
          <Papier className="p-5 mt-3">
            <h2 className="text-[19px] font-medium mb-3">Salden</h2>
            <ul>
              {aktive.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5 trennstrich last:border-b-0">
                  <PersonChip person={m} />
                  <span className="flex-1 font-bold truncate">{m.display_name}</span>
                  <Saldo cents={abrechnung.balances.get(m.id) ?? 0} currency={group.base_currency} />
                </li>
              ))}
            </ul>
          </Papier>

          <Papier className="p-5 mt-3">
            <h2 className="text-[19px] font-medium mb-1">
              {abrechnung.payments.length === 1
                ? 'Eine Zahlung, dann seid ihr quitt'
                : `${abrechnung.payments.length} Zahlungen, dann seid ihr quitt`}
            </h2>
            <p className="text-sm text-tinte-2 mb-3">
              {group.netting_mode === 'graph'
                ? 'Dreiecke sind aufgelöst, das ist die kürzeste Variante.'
                : 'Nur direkte Paare, niemand zahlt an Unbeteiligte.'}
            </p>

            <ul>
              {abrechnung.payments.map((z, i) => {
                const von = person(z.fromId)
                const an = person(z.toId)
                if (!von || !an) return null
                const schluessel = `${z.fromId}-${z.toId}`

                return (
                  <li key={`${schluessel}-${i}`} className="py-3 trennstrich last:border-b-0">
                    <div className="flex items-center gap-2 relative">
                      <PersonChip person={von} />
                      <MuenzFlug
                        aktiv={fliegt === schluessel}
                        betrag={formatMoney(z.amountCents, group.base_currency)}
                      />
                      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className="text-tinte-2 shrink-0">
                        <path
                          d="M4 12h16m-6-6l6 6-6 6"
                          stroke="currentColor"
                          strokeWidth="2"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <PersonChip person={an} />
                      <span className="flex-1" />
                      <Betrag cents={z.amountCents} currency={group.base_currency} />
                    </div>

                    <div className="flex items-center gap-2 mt-2.5">
                      <span className="text-sm text-tinte-2 flex-1 truncate">
                        {von.display_name} an {an.display_name}
                      </span>
                      <Knopf
                        art="zweit"
                        onClick={() => zahlungMarkieren(z)}
                        disabled={ausgleichen.isPending}
                      >
                        Bezahlt
                      </Knopf>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Papier>
        </>
      )}

      {settlements.length > 0 && (
        <Papier className="p-5 mt-3">
          <h2 className="text-[19px] font-medium mb-3">Schon ausgeglichen</h2>
          <ul>
            {settlements.map((s) => {
              const von = person(s.from_id)
              const an = person(s.to_id)
              return (
                <li key={s.id} className="py-3 trennstrich last:border-b-0">
                  <div className="flex items-baseline gap-3">
                    <span className="flex-1 min-w-0 truncate">
                      {von?.display_name ?? '?'} an {an?.display_name ?? '?'}
                    </span>
                    <Betrag cents={s.amount_cents} currency={group.base_currency} />
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex-1 font-mono tabular text-sm text-tinte-2">
                      {formatDate(new Date(s.settled_at).toISOString().slice(0, 10))}
                    </span>
                    <Knopf art="geist" onClick={() => ausgleichZurueck.mutate(s.id)} className="!px-2">
                      Zurücknehmen
                    </Knopf>
                  </div>
                </li>
              )
            })}
          </ul>
        </Papier>
      )}
    </Rahmen>
  )
}

/** The stamp fires once when the screen is reached in a settled state. */
function QuittMoment({ zettiAn }: { zettiAn: boolean }) {
  const gefeiert = useRef(false)
  const [spielen] = useState(() => {
    if (gefeiert.current) return false
    gefeiert.current = true
    return true
  })

  return (
    <Papier className="p-6 mt-3 flex flex-col items-center text-center">
      <QuittStempel spielen={spielen} />
      <p className="text-tinte-2 mt-2">Keine offenen Posten mehr.</p>
      {zettiAn && <Zetti groesse={88} className="mt-4" />}
    </Papier>
  )
}

/**
 * The coin arcs from debtor to creditor when a payment is marked. Shows in
 * one second who gave what to whom.
 */
function MuenzFlug({ aktiv, betrag }: { aktiv: boolean; betrag: string }) {
  if (!aktiv) return null

  return (
    <span
      aria-hidden="true"
      className="absolute left-8 top-1 pointer-events-none"
      style={{ animation: 'flugx 760ms linear forwards' }}
    >
      <span
        className="grid place-items-center w-9 h-9 rounded-pille font-fredoka font-semibold text-[11px] whitespace-nowrap px-1"
        style={{
          background: 'var(--bon)',
          color: '#7A5200',
          animation: 'flugy 760ms cubic-bezier(.4,0,.6,1) forwards, muenzdreh 760ms linear forwards',
        }}
      >
        {betrag}
      </span>
    </span>
  )
}
