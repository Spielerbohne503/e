import { useState } from 'react'
import type { Budget } from '@/shared/api'
import { CATEGORIES, CATEGORY_LABELS, type Category } from '@/shared/api'
import { Knopf } from '@/components/Knopf'
import { Feld, Umschalter } from '@/components/Feld'
import { useBudgetLoeschen, useBudgetSpeichern } from '@/api/hooks'
import { parseAmount, today } from '@/lib/format'

/** Creating or editing the budget. Default is no budget at all. */
export function BudgetFormular({
  gruppeId,
  basiswaehrung,
  budget,
  onFertig,
}: {
  gruppeId: string
  basiswaehrung: string
  budget?: Budget
  onFertig: () => void
}) {
  const speichern = useBudgetSpeichern(gruppeId)
  const loeschen = useBudgetLoeschen(gruppeId)

  const [betragText, setBetragText] = useState(
    budget ? (budget.amount_cents / 100).toFixed(2).replace('.', ',') : '',
  )
  const [zeitraum, setZeitraum] = useState<'once' | 'weekly' | 'monthly'>(budget?.period ?? 'monthly')
  const [start, setStart] = useState(budget?.starts_on ?? today())
  const [ende, setEnde] = useState(budget?.ends_on ?? '')
  const [kategorien, setKategorien] = useState<string[]>(() =>
    budget?.categories ? (JSON.parse(budget.categories) as string[]) : [],
  )

  const betragCents = parseAmount(betragText, basiswaehrung) ?? 0

  const absenden = () => {
    speichern.mutate(
      {
        id: budget?.id,
        body: {
          amount_cents: betragCents,
          currency: basiswaehrung,
          period: zeitraum,
          starts_on: start,
          ends_on: zeitraum === 'once' && ende ? ende : null,
          // An empty selection means every category counts.
          categories: kategorien.length > 0 ? kategorien : null,
          active: true,
        },
      },
      { onSuccess: onFertig },
    )
  }

  return (
    <div className="grid gap-4 pb-2">
      <Feld
        label="Wie viel?"
        value={betragText}
        onChange={(e) => setBetragText(e.target.value)}
        inputMode="decimal"
        placeholder="600,00"
        mono
        hinweis={`In ${basiswaehrung}, der Basiswährung der Gruppe.`}
      />

      <div>
        <span className="block text-sm font-bold mb-1.5">Zeitraum</span>
        <Umschalter
          label="Zeitraum"
          wert={zeitraum}
          onWechsel={setZeitraum}
          optionen={[
            { wert: 'monthly', text: 'Monatlich' },
            { wert: 'weekly', text: 'Wöchentlich' },
            { wert: 'once', text: 'Einmalig' },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Feld label="Ab wann?" type="date" value={start} onChange={(e) => setStart(e.target.value)} mono />
        {zeitraum === 'once' && (
          <Feld label="Bis wann?" type="date" value={ende} onChange={(e) => setEnde(e.target.value)} mono />
        )}
      </div>

      <div>
        <span className="block text-sm font-bold mb-1.5">Kategorien</span>
        <p className="text-sm text-tinte-2 mb-2">Nichts ausgewählt heißt: alles zählt mit.</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const an = kategorien.includes(c)
            return (
              <button
                key={c}
                type="button"
                aria-pressed={an}
                onClick={() =>
                  setKategorien((alt) => (an ? alt.filter((x) => x !== c) : [...alt, c]))
                }
                className={`min-h-9 px-3 rounded-pille text-sm border transition-colors duration-[--dauer-tipp] ${
                  an ? 'bg-nacht text-white border-transparent' : 'bg-papier border-strich text-tinte-2'
                }`}
              >
                {CATEGORY_LABELS[c as Category]}
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-sm text-tinte-2">
        Gezählt wird jede Ausgabe im Zeitraum, egal wer gezahlt hat. Ausgleichszahlungen zählen nicht
        mit, sonst stünde alles doppelt drin.
      </p>

      <Knopf breit onClick={absenden} disabled={betragCents <= 0 || speichern.isPending}>
        {budget ? 'Budget ändern' : 'Budget anlegen'}
      </Knopf>

      {budget && (
        <Knopf art="gefahr" breit onClick={() => loeschen.mutate(budget.id, { onSuccess: onFertig })}>
          Budget löschen
        </Knopf>
      )}
    </div>
  )
}
