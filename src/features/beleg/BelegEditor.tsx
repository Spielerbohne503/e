import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ItemKind } from '@/core/types'
import type { Member, Snapshot } from '@/shared/api'
import { allocateReceipt } from '@/core/allocate'
import { baueVorschlaege, vorschlagFuer } from '@/core/statistik'
import { Papier, Bon, Handnotiz } from '@/components/Papier'
import { Knopf, IkonKnopf } from '@/components/Knopf'
import { Feld, Auswahl, Textfeld } from '@/components/Feld'
import { PersonChip } from '@/components/Person'
import { Betrag } from '@/components/Betrag'
import { WaehrungsKnopf } from '@/components/WaehrungsWaehler'
import { formatMoney } from '@/lib/format'
import { useBelegLoeschen, useBelegSpeichern, zuCoreDaten } from '@/api/hooks'
import { KlebeNotiz, Knuellbar } from '@/components/Bewegung'
import { ZuordnungsSheet } from './ZuordnungsSheet'
import {
  alsApiKoerper,
  betragAus,
  KIND_LABELS,
  leerePosition,
  positionsSumme,
  textFuer,
  type BelegEntwurf,
  type EntwurfPosition,
} from './entwurf'
import { CATEGORIES, CATEGORY_LABELS, type Category } from '@/shared/api'

/**
 * The receipt form. Header on paper, line items on a bon strip — the two
 * paper stocks are never mixed, and the amounts sit on a quiet surface.
 */
export function BelegEditor({
  gruppeId,
  snapshot,
  start,
}: {
  gruppeId: string
  snapshot: Snapshot
  start: BelegEntwurf
}) {
  const navigate = useNavigate()
  const speichern = useBelegSpeichern(gruppeId)
  const loeschen = useBelegLoeschen(gruppeId)
  const [entwurf, setEntwurf] = useState<BelegEntwurf>(start)
  const [zuordnung, setZuordnung] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  const mitglieder = snapshot.members.filter((m) => !m.archived)
  const summe = positionsSumme(entwurf)
  const differenz = entwurf.totalCents - summe

  const anteile = useMemo(() => {
    return allocateReceipt(
      {
        id: 'entwurf',
        payerId: entwurf.payerId,
        currency: entwurf.currency,
        fxRateToBase: entwurf.fxRateToBase,
        totalCents: entwurf.totalCents,
        date: entwurf.date || null,
        merchant: entwurf.merchant || null,
        items: entwurf.positionen.map((p, i) => ({
          id: p.key,
          name: p.name,
          qty: p.qty,
          totalCents: p.totalCents,
          kind: p.kind,
          category: p.category,
          sortOrder: i,
          splits: p.splits.map((s) => ({ memberId: s.memberId, mode: s.mode, value: s.value })),
        })),
      },
      mitglieder.map((m) => ({ id: m.id, sortOrder: m.sort_order })),
    )
  }, [entwurf, mitglieder])

  // What this group did with the same article before. Only articles seen at
  // least twice make it in, so a one-off never becomes a habit.
  const vorschlaege = useMemo(
    () => baueVorschlaege(zuCoreDaten(snapshot).receipts.filter((r) => r.id !== start.id)),
    [snapshot, start.id],
  )

  const aendere = (teil: Partial<BelegEntwurf>) => setEntwurf((alt) => ({ ...alt, ...teil }))

  const positionAendern = (key: string, teil: Partial<EntwurfPosition>) => {
    setEntwurf((alt) => ({
      ...alt,
      positionen: alt.positionen.map((p) => (p.key === key ? { ...p, ...teil } : p)),
    }))
  }

  const positionHinzu = (kind: ItemKind = 'item') => {
    setEntwurf((alt) => ({ ...alt, positionen: [...alt.positionen, leerePosition(kind)] }))
  }

  /** Fills the receipt total from the lines — the usual case for a till receipt. */
  const summeUebernehmen = () => {
    aendere({ totalCents: summe, summeText: textFuer(summe, entwurf.currency) })
  }

  const kannSpeichern =
    entwurf.payerId !== '' && entwurf.positionen.some((p) => p.name.trim() || p.totalCents !== 0)

  const absenden = () => {
    setFehler(null)
    speichern.mutate(
      { id: entwurf.id, body: alsApiKoerper(entwurf) },
      {
        onSuccess: () => navigate(`/g/${gruppeId}`),
        onError: (e) => setFehler(e instanceof Error ? e.message : 'Speichern ging nicht'),
      },
    )
  }

  const offenePosition = entwurf.positionen.find((p) => p.key === zuordnung)

  return (
    <>
      <Papier className="p-5 mt-3">
        <div className="grid gap-3">
          <div className="flex gap-2 items-end">
            <Feld
              label="Wo?"
              value={entwurf.merchant}
              onChange={(e) => aendere({ merchant: e.target.value })}
              placeholder="REWE, Restaurant, …"
              className="flex-1"
            />
            <div className="pb-0.5">
              <span className="block text-sm font-bold mb-1.5">Währung</span>
              <WaehrungsKnopf
                code={entwurf.currency}
                onWaehlen={(code) => aendere({ currency: code })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Feld
              label="Wann?"
              type="date"
              value={entwurf.date}
              onChange={(e) => aendere({ date: e.target.value })}
              mono
            />
            <Auswahl
              label="Wer hat gezahlt?"
              value={entwurf.payerId}
              onChange={(e) => aendere({ payerId: e.target.value })}
            >
              {mitglieder.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </Auswahl>
          </div>

          <Feld
            label="Was stand auf dem Bon?"
            value={entwurf.summeText}
            onChange={(e) =>
              aendere({
                summeText: e.target.value,
                totalCents: betragAus(e.target.value, entwurf.currency),
              })
            }
            inputMode="decimal"
            placeholder="0,00"
            mono
            hinweis="Die Gesamtsumme, wie sie an der Kasse stand."
          />
        </div>
      </Papier>

      {/* Line items live on the bon strip. */}
      <Bon className="mt-4">
        <div className="px-5 pt-5 pb-1">
          <h2 className="text-[19px] font-medium">Positionen</h2>
        </div>

        <ul className="px-5">
          {entwurf.positionen.map((p) => (
            <Knuellbar
              key={p.key}
              beschreibung={p.name.trim() || KIND_LABELS[p.kind]}
              onEntfernen={() =>
                setEntwurf((alt) => ({
                  ...alt,
                  positionen: alt.positionen.filter((x) => x.key !== p.key),
                }))
              }
            >
              {(loeschen: () => void) => (
                <PositionsZeile
                  position={p}
                  mitglieder={mitglieder}
                  currency={entwurf.currency}
                  vorschlag={p.splits.length === 0 ? vorschlagFuer(vorschlaege, p.name) : null}
                  onAendern={(teil) => positionAendern(p.key, teil)}
                  onZuordnen={() => setZuordnung(p.key)}
                  onEntfernen={entwurf.positionen.length > 1 ? loeschen : undefined}
                />
              )}
            </Knuellbar>
          ))}
        </ul>

        <div className="px-5 pt-2 pb-6 flex flex-wrap gap-2">
          <Knopf art="geist" onClick={() => positionHinzu('item')} className="-ml-1">
            + Position
          </Knopf>
          <Knopf art="geist" onClick={() => positionHinzu('tip')}>
            + Trinkgeld
          </Knopf>
          <Knopf art="geist" onClick={() => positionHinzu('discount')}>
            + Rabatt
          </Knopf>
        </div>
      </Bon>

      {/* The gap between the lines and the till total, if there is one. */}
      {differenz !== 0 && entwurf.totalCents !== 0 && (
        <div className="rounded-karte bg-bon-weich px-4 py-3 mt-2" role="status">
          <p className="font-bold">
            {differenz > 0
              ? `${formatMoney(differenz, entwurf.currency)} sind noch nicht erfasst`
              : `${formatMoney(-differenz, entwurf.currency)} zu viel erfasst`}
          </p>
          <p className="text-sm text-tinte-2 mt-0.5">
            Die Positionen ergeben {formatMoney(summe, entwurf.currency)}, auf dem Bon stehen{' '}
            {formatMoney(entwurf.totalCents, entwurf.currency)}.
          </p>
          <Knopf art="zweit" onClick={summeUebernehmen} className="mt-2.5">
            Summe übernehmen
          </Knopf>
        </div>
      )}

      {entwurf.totalCents === 0 && summe !== 0 && (
        <div className="rounded-karte bg-mint-weich px-4 py-3 mt-2">
          <Knopf art="zweit" onClick={summeUebernehmen}>
            {formatMoney(summe, entwurf.currency)} als Summe übernehmen
          </Knopf>
        </div>
      )}

      {/* Live preview of what each person carries. */}
      {anteile.size > 0 && (
        <Papier className="p-5 mt-4">
          <h2 className="text-[19px] font-medium mb-3">Wer trägt was</h2>
          <ul>
            {mitglieder
              .filter((m) => anteile.has(m.id))
              .map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5 trennstrich last:border-b-0">
                  <PersonChip person={m} />
                  <span className="flex-1 font-bold truncate">{m.display_name}</span>
                  <Betrag cents={anteile.get(m.id) ?? 0} currency={entwurf.currency} />
                </li>
              ))}
          </ul>
          <Handnotiz className="mt-4">
            Sammelposten gehen anteilig mit
          </Handnotiz>
        </Papier>
      )}

      <Papier className="p-5 mt-4">
        {/* A note that was already saved is shown as what it is: a sticky
            note on the receipt. Exactly one per screen. */}
        {start.note.trim() && (
          <div className="flex justify-center mb-5">
            <KlebeNotiz text={start.note.trim()} />
          </div>
        )}
        <Textfeld
          label="Notiz"
          value={entwurf.note}
          onChange={(e) => aendere({ note: e.target.value })}
          placeholder="Milch war im Angebot, deshalb 0,89 statt 1,19"
        />
      </Papier>

      {fehler && (
        <p className="mt-3 rounded-karte bg-fehler-weich text-fehler px-4 py-3" role="alert">
          {fehler}
        </p>
      )}

      <div className="flex gap-2 mt-4">
        <Knopf breit onClick={absenden} disabled={!kannSpeichern || speichern.isPending}>
          {speichern.isPending ? 'Wird gespeichert' : 'Speichern'}
        </Knopf>
      </div>

      {entwurf.id && (
        <Knopf
          art="gefahr"
          breit
          className="mt-2"
          onClick={() => {
            loeschen.mutate(entwurf.id!, { onSuccess: () => navigate(`/g/${gruppeId}`) })
          }}
        >
          Beleg löschen
        </Knopf>
      )}

      {offenePosition && (
        <ZuordnungsSheet
          offen
          position={offenePosition}
          members={mitglieder}
          currency={entwurf.currency}
          onSchliessen={() => setZuordnung(null)}
          onSpeichern={(splits) => positionAendern(offenePosition.key, { splits })}
        />
      )}
    </>
  )
}

/** One line on the bon: name, amount, and who is on it. */
function PositionsZeile({
  position,
  mitglieder,
  currency,
  vorschlag,
  onAendern,
  onZuordnen,
  onEntfernen,
}: {
  position: EntwurfPosition
  mitglieder: Member[]
  currency: string
  /** Learned from the group's history; null when there is nothing to go on. */
  vorschlag: { memberIds: string[]; belege: number } | null
  onAendern: (teil: Partial<EntwurfPosition>) => void
  onZuordnen: () => void
  onEntfernen?: () => void
}) {
  const zugeordnet = mitglieder.filter((m) => position.splits.some((s) => s.memberId === m.id))
  const istSammelposten = position.kind !== 'item'

  return (
    <li className="py-3 trennstrich last:border-b-0">
      <div className="flex items-center gap-2">
        <input
          value={position.name}
          onChange={(e) => onAendern({ name: e.target.value })}
          placeholder={KIND_LABELS[position.kind]}
          aria-label="Bezeichnung"
          className="flex-1 min-w-0 min-h-11 px-2.5 rounded-klein bg-papier border border-strich focus:border-lavendel"
        />
        <input
          value={position.betragText}
          onChange={(e) =>
            onAendern({
              betragText: e.target.value,
              // A discount is stored negative, so the lines add up to the total.
              totalCents:
                position.kind === 'discount'
                  ? -Math.abs(betragAus(e.target.value, currency))
                  : betragAus(e.target.value, currency),
            })
          }
          inputMode="decimal"
          placeholder="0,00"
          aria-label="Betrag"
          className="w-24 shrink-0 min-h-11 px-2 text-right font-mono tabular rounded-klein bg-papier border border-strich focus:border-lavendel"
        />
        {onEntfernen && (
          <IkonKnopf label={`${position.name || 'Position'} entfernen`} onClick={onEntfernen}>
            <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </IkonKnopf>
        )}
      </div>

      {vorschlag && vorschlag.memberIds.length > 0 && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <button
            type="button"
            onClick={() =>
              onAendern({
                splits: vorschlag.memberIds.map((memberId) => ({
                  memberId,
                  mode: 'equal' as const,
                  value: 1,
                })),
              })
            }
            className="tap-ziel flex items-center gap-1.5 min-h-9 px-2.5 rounded-pille bg-lavendel-weich text-sm"
          >
            <span className="flex -space-x-1.5">
              {vorschlag.memberIds
                .map((mid) => mitglieder.find((m) => m.id === mid))
                .filter((m): m is Member => Boolean(m))
                .map((m) => (
                  <PersonChip key={m.id} person={m} className="!w-5 !h-5 !text-[10px]" />
                ))}
            </span>
            wie sonst auch
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {istSammelposten ? (
          <span className="text-sm px-2.5 py-1 rounded-pille bg-lavendel-weich text-tinte">
            {KIND_LABELS[position.kind]}
          </span>
        ) : (
          <select
            value={position.category ?? ''}
            onChange={(e) => onAendern({ category: e.target.value || null })}
            aria-label="Kategorie"
            className="tap-ziel text-sm min-h-9 px-2 rounded-pille bg-papier border border-strich"
          >
            <option value="">Kategorie</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c as Category]}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          onClick={onZuordnen}
          className="tap-ziel flex items-center gap-1.5 min-h-9 px-2.5 rounded-pille bg-papier border border-strich"
          aria-label={
            zugeordnet.length === 0
              ? 'Personen zuordnen'
              : `Zugeordnet: ${zugeordnet.map((m) => m.display_name).join(', ')}. Antippen zum Ändern`
          }
        >
          {zugeordnet.length === 0 ? (
            <span className="text-sm text-koralle font-bold">
              {istSammelposten ? 'Anteilig' : 'Offen'}
            </span>
          ) : (
            <span className="flex -space-x-1.5">
              {zugeordnet.slice(0, 5).map((m) => (
                <PersonChip key={m.id} person={m} className="!w-6 !h-6 !text-[11px] ring-2 ring-papier" />
              ))}
              {zugeordnet.length > 5 && (
                <span className="text-sm text-tinte-2 pl-2.5">+{zugeordnet.length - 5}</span>
              )}
            </span>
          )}
        </button>
      </div>
    </li>
  )
}
