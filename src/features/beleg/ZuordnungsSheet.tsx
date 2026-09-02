import { useMemo, useState } from 'react'
import type { Member } from '@/shared/api'
import type { SplitMode } from '@/core/types'
import { splitItem } from '@/core/split'
import { Sheet } from '@/components/Sheet'
import { Knopf } from '@/components/Knopf'
import { Umschalter } from '@/components/Feld'
import { PersonChip } from '@/components/Person'
import { Betrag } from '@/components/Betrag'
import { formatMoney, parseAmount } from '@/lib/format'
import type { EntwurfPosition, EntwurfSplit } from './entwurf'
import { KIND_LABELS } from './entwurf'

const MODUS_TEXT: Record<SplitMode, string> = {
  equal: 'Gleich',
  shares: 'Anteile',
  percent: 'Prozent',
  fixed: 'Beträge',
}

/**
 * Assigning a line to people. Tapping a person toggles them; the mode decides
 * how the amount is divided. The preview underneath uses the very same core
 * function the saved receipt will, so what you see is what gets stored.
 */
export function ZuordnungsSheet({
  offen,
  position,
  members,
  currency,
  onSchliessen,
  onSpeichern,
}: {
  offen: boolean
  position: EntwurfPosition
  members: Member[]
  currency: string
  onSchliessen: () => void
  onSpeichern: (splits: EntwurfSplit[]) => void
}) {
  const [modus, setModus] = useState<SplitMode>(position.splits[0]?.mode ?? 'equal')
  const [splits, setSplits] = useState<EntwurfSplit[]>(position.splits)

  const beteiligt = (id: string) => splits.some((s) => s.memberId === id)

  const umschalten = (id: string) => {
    setSplits((alt) =>
      beteiligt(id)
        ? alt.filter((s) => s.memberId !== id)
        : [...alt, { memberId: id, mode: modus, value: standardWert(modus, alt.length) }],
    )
  }

  const modusWechseln = (neu: SplitMode) => {
    setModus(neu)
    // Carry the people over, reset the numbers to something sensible for the
    // new mode rather than reinterpreting a share count as a percentage.
    setSplits((alt) =>
      alt.map((s, _, arr) => ({ ...s, mode: neu, value: standardWert(neu, arr.length, arr.length) })),
    )
  }

  const wertSetzen = (id: string, roh: string) => {
    const wert =
      modus === 'fixed' ? (parseAmount(roh, currency) ?? 0) : Number(roh.replace(',', '.')) || 0
    setSplits((alt) => alt.map((s) => (s.memberId === id ? { ...s, value: wert } : s)))
  }

  // The live preview: exactly the numbers that will be stored.
  const vorschau = useMemo(() => {
    return splitItem(
      {
        id: position.key,
        name: position.name,
        qty: position.qty,
        totalCents: position.totalCents,
        kind: position.kind,
        category: position.category,
        sortOrder: 0,
        splits: splits.map((s) => ({ memberId: s.memberId, mode: s.mode, value: s.value })),
      },
      members.map((m) => ({ id: m.id, sortOrder: m.sort_order })),
    )
  }, [position, splits, members])

  const summeProzent = splits.reduce((a, s) => a + s.value, 0)
  const warnung =
    modus === 'percent' && splits.length > 0 && Math.abs(summeProzent - 100) > 0.01
      ? `Die Prozente ergeben ${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(summeProzent)} statt 100`
      : modus === 'fixed' && splits.length > 0 && Math.round(summeProzent) !== position.totalCents
        ? `Die Beträge ergeben ${formatMoney(Math.round(summeProzent), currency)} statt ${formatMoney(position.totalCents, currency)}`
        : null

  return (
    <Sheet
      offen={offen}
      titel={position.name.trim() || KIND_LABELS[position.kind]}
      onSchliessen={onSchliessen}
      fussleiste={
        <Knopf
          breit
          onClick={() => {
            onSpeichern(splits)
            onSchliessen()
          }}
        >
          Übernehmen
        </Knopf>
      }
    >
      {/* At 360px the four modes need their own line rather than squeezing
          in beside the amount. */}
      <div className="flex flex-col gap-3 mb-3">
        <Betrag cents={position.totalCents} currency={currency} className="text-[22px]" />
        <Umschalter
          label="Aufteilung"
          wert={modus}
          onWechsel={modusWechseln}
          optionen={(['equal', 'shares', 'percent', 'fixed'] as const).map((w) => ({
            wert: w,
            text: MODUS_TEXT[w],
          }))}
        />
      </div>

      <p className="text-sm text-tinte-2 mb-3">{hinweisFuer(modus)}</p>

      <div className="flex flex-wrap gap-2.5 mb-4">
        {members.map((m) => (
          <PersonChip
            key={m.id}
            person={m}
            aktiv={beteiligt(m.id)}
            onClick={() => umschalten(m.id)}
            gross
          />
        ))}
      </div>

      {splits.length > 0 && (
        <ul className="mb-3">
          {splits.map((s) => {
            const person = members.find((m) => m.id === s.memberId)
            if (!person) return null
            return (
              <li key={s.memberId} className="flex items-center gap-3 py-2.5 trennstrich last:border-b-0">
                <PersonChip person={person} />
                <span className="flex-1 truncate font-bold">{person.display_name}</span>

                {modus !== 'equal' && (
                  <input
                    inputMode="decimal"
                    value={
                      modus === 'fixed'
                        ? s.value === 0
                          ? ''
                          : (s.value / 100).toFixed(2).replace('.', ',')
                        : s.value === 0
                          ? ''
                          : String(s.value).replace('.', ',')
                    }
                    onChange={(e) => wertSetzen(s.memberId, e.target.value)}
                    aria-label={`${modus === 'percent' ? 'Prozent' : modus === 'shares' ? 'Anteile' : 'Betrag'} für ${person.display_name}`}
                    className="w-20 min-h-11 px-2 text-right font-mono tabular rounded-klein bg-papier border border-strich focus:border-lavendel"
                  />
                )}

                <Betrag
                  cents={vorschau.get(s.memberId) ?? 0}
                  currency={currency}
                  className="w-24 text-right text-tinte-2"
                />
              </li>
            )
          })}
        </ul>
      )}

      {splits.length === 0 && (
        <p className="text-tinte-2 py-4 text-center">
          Noch niemand ausgewählt. Diese Position bleibt offen.
        </p>
      )}

      {warnung && (
        <p className="text-sm rounded-klein bg-bon-weich px-3 py-2 mb-2" role="status">
          {warnung}
        </p>
      )}
    </Sheet>
  )
}

function standardWert(modus: SplitMode, anzahl: number, gesamt = anzahl + 1): number {
  if (modus === 'percent') return gesamt > 0 ? Math.round((100 / gesamt) * 10) / 10 : 100
  if (modus === 'shares') return 1
  if (modus === 'fixed') return 0
  return 1
}

function hinweisFuer(modus: SplitMode): string {
  switch (modus) {
    case 'equal':
      return 'Gleichmäßig unter allen Ausgewählten. Cent-Reste gehen nach Reihenfolge.'
    case 'shares':
      return 'Anteile, etwa zwei Bier zu einem.'
    case 'percent':
      return 'Prozent, muss auf 100 aufgehen.'
    case 'fixed':
      return 'Feste Beträge, müssen die Position ergeben.'
  }
}
