import { Link, useParams } from 'react-router-dom'
import { Rahmen, SchwebeAktion } from '@/components/Rahmen'
import { Karteikarte, Papier } from '@/components/Papier'
import { KnopfLink, IkonKnopf } from '@/components/Knopf'
import { Betrag, Saldo } from '@/components/Betrag'
import { PersonChip } from '@/components/Person'
import { LeerZustand } from '@/components/Zetti'
import { Skelett } from '@/components/Skelett'
import { BudgetLeiste } from '@/features/budget/BudgetLeiste'
import { useAbrechnung, useSnapshot } from '@/api/hooks'
import { formatDate } from '@/lib/format'
import { VerbindungsHinweis } from '@/components/VerbindungsHinweis'

/**
 * The group's home screen: what is open, who owes whom, and the receipts
 * in reverse chronological order.
 */
export function GruppeStart() {
  const { id = '' } = useParams()
  const { data, isLoading, offline, keinZugriff } = useSnapshot(id)
  const abrechnung = useAbrechnung(data)

  if (isLoading) {
    return (
      <Rahmen titel="…" zurueck="/">
        <Papier className="p-6 mt-4">
          <Skelett zeilen={5} />
        </Papier>
      </Rahmen>
    )
  }

  if (keinZugriff) {
    return (
      <Rahmen titel="Kein Zugriff" zurueck="/">
        <Papier className="p-6 mt-4">
          <p>Diese Gruppe lässt sich mit dem gespeicherten Link nicht mehr öffnen.</p>
          <p className="text-tinte-2 text-sm mt-2">
            Wahrscheinlich wurde der Token neu erzeugt. Frag nach einem frischen Link.
          </p>
        </Papier>
      </Rahmen>
    )
  }

  if (!data) {
    return (
      <Rahmen titel="Nicht gefunden" zurueck="/">
        <Papier className="p-6 mt-4">
          <p>Diese Gruppe gibt es nicht mehr.</p>
        </Papier>
      </Rahmen>
    )
  }

  const { group, members, receipts, budgets } = data
  const aktiveMitglieder = members.filter((m) => !m.archived)
  const budget = budgets.find((b) => b.active === 1)

  const offeneZahlungen = abrechnung?.payments.length ?? 0

  return (
    <Rahmen
      titel={group.name}
      zurueck="/"
      aktion={
        <IkonKnopf label="Einstellungen">
          <Link to={`/g/${id}/einstellungen`} aria-label="Einstellungen" className="grid place-items-center w-11 h-11">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none">
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
              <path
                d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </Link>
        </IkonKnopf>
      }
      kopfzeile={budget ? <BudgetLeiste gruppeId={id} snapshot={data} budget={budget} /> : undefined}
    >
      {offline && <VerbindungsHinweis />}

      {/* Balances in short form; the full picture is one tap away. */}
      {aktiveMitglieder.length > 0 && (
        <Link to={`/g/${id}/salden`} className="block mt-3">
          <Papier className="p-5">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-[19px] font-medium">Stand</h2>
              <span className="text-sm text-tinte-2">
                {offeneZahlungen === 0
                  ? 'Ihr seid quitt'
                  : offeneZahlungen === 1
                    ? 'Eine Zahlung offen'
                    : `${offeneZahlungen} Zahlungen offen`}
              </span>
            </div>

            <ul>
              {aktiveMitglieder.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5 trennstrich last:border-b-0">
                  <PersonChip person={m} />
                  <span className="flex-1 font-bold truncate">{m.display_name}</span>
                  <Saldo cents={abrechnung?.balances.get(m.id) ?? 0} currency={group.base_currency} />
                </li>
              ))}
            </ul>
          </Papier>
        </Link>
      )}

      {receipts.length === 0 ? (
        <LeerZustand
          text="Noch keine Belege. Erfass den ersten, dann rechnet quitt mit."
          zettiAn={group.show_zetti === 1}
        >
          <KnopfLink to={`/g/${id}/beleg/neu`}>Beleg erfassen</KnopfLink>
        </LeerZustand>
      ) : (
        <>
          <div className="flex items-baseline justify-between mt-6 mb-3">
            <h2 className="text-[19px] font-medium">Belege</h2>
            <Link to={`/g/${id}/auswertung`} className="tap-ziel inline-flex items-center text-sm text-tinte-2 underline underline-offset-4">
              Auswertung
            </Link>
          </div>
          <ul className="grid gap-3">
            {receipts.map((r, i) => {
              const zahler = members.find((m) => m.id === r.payer_id)
              const offen = r.items.filter((it) => it.kind === 'item' && it.splits.length === 0).length

              return (
                <li key={r.id}>
                  <Link to={`/g/${id}/beleg/${r.id}`} className="block">
                    <Karteikarte kipp={i === 0 ? 'r' : undefined}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <span className="font-fredoka text-[18px] font-medium block truncate">
                            {r.merchant || (r.source === 'travel' ? 'Fahrt' : 'Beleg')}
                          </span>
                          <div className="font-mono tabular text-sm text-tinte-2 mt-1">
                            {formatDate(r.date)}
                            {r.items.length > 0 && ` · ${r.items.length} ${r.items.length === 1 ? 'Position' : 'Positionen'}`}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <Betrag cents={r.total_cents} currency={r.currency} className="text-[19px]" />
                          {zahler && (
                            <div className="flex items-center gap-1.5 justify-end mt-1.5">
                              <span className="text-sm text-tinte-2">zahlte</span>
                              <PersonChip person={zahler} gross={false} className="!w-6 !h-6 !text-[11px]" />
                            </div>
                          )}
                        </div>
                      </div>

                      {offen > 0 && (
                        <p className="text-sm text-koralle mt-3 font-bold">
                          {offen === 1 ? 'Ein Posten offen' : `${offen} Posten offen`}
                        </p>
                      )}
                    </Karteikarte>
                  </Link>
                </li>
              )
            })}
          </ul>

          <SchwebeAktion>
            <KnopfLink to={`/g/${id}/beleg/neu`}>Beleg erfassen</KnopfLink>
          </SchwebeAktion>
        </>
      )}

      {aktiveMitglieder.length === 0 && (
        <Papier className="p-5 mt-4">
          <p className="mb-3">In dieser Gruppe ist noch niemand.</p>
          <KnopfLink to={`/g/${id}/einstellungen`} art="zweit">
            Personen anlegen
          </KnopfLink>
        </Papier>
      )}
    </Rahmen>
  )
}
