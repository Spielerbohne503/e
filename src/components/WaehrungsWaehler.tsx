import { useMemo, useState } from 'react'
import { Sheet } from './Sheet'
import { letzteWaehrungen, merkeWaehrung } from '@/lib/speicher'
import { sucheWaehrungen, symbolFuer, waehrung, WAEHRUNGEN } from '@/lib/waehrungen'

/**
 * Tapping the currency symbol spins it once and brings up the sheet.
 * The rotation is what ties the trigger to the result.
 */
export function WaehrungsKnopf({
  code,
  onWaehlen,
  disabled,
}: {
  code: string
  onWaehlen: (code: string) => void
  disabled?: boolean
}) {
  const [offen, setOffen] = useState(false)
  const [dreht, setDreht] = useState(false)

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-label={`Währung: ${waehrung(code).de}. Antippen zum Wechseln`}
        onClick={() => {
          setDreht(false)
          requestAnimationFrame(() => setDreht(true))
          setTimeout(() => setDreht(false), 400)
          setOffen(true)
        }}
        className="inline-grid place-items-center min-w-11 min-h-11 px-3 rounded-klein font-fredoka text-[20px] text-nacht bg-papier border border-strich disabled:opacity-45"
        style={{ animation: dreht ? 'eurodreh var(--dauer-sheet) var(--ease-zack)' : undefined }}
      >
        {symbolFuer(code)}
      </button>

      <WaehrungsSheet
        offen={offen}
        aktuell={code}
        onSchliessen={() => setOffen(false)}
        onWaehlen={(neu) => {
          merkeWaehrung(neu)
          onWaehlen(neu)
          setOffen(false)
        }}
      />
    </>
  )
}

export function WaehrungsSheet({
  offen,
  aktuell,
  onSchliessen,
  onWaehlen,
}: {
  offen: boolean
  aktuell: string
  onSchliessen: () => void
  onWaehlen: (code: string) => void
}) {
  const [suche, setSuche] = useState('')

  // Recently used float to the top, so the usual two or three are one tap away.
  const liste = useMemo(() => {
    const treffer = sucheWaehrungen(suche)
    if (suche.trim()) return treffer

    const zuletzt = letzteWaehrungen()
    const oben = zuletzt
      .map((c) => WAEHRUNGEN.find((w) => w.code === c))
      .filter((w): w is (typeof WAEHRUNGEN)[number] => Boolean(w))
    const rest = treffer.filter((w) => !zuletzt.includes(w.code))
    return [...oben, ...rest]
  }, [suche])

  return (
    <Sheet offen={offen} titel="Währung" onSchliessen={onSchliessen}>
      <input
        type="search"
        value={suche}
        onChange={(e) => setSuche(e.target.value)}
        placeholder="Code, Name oder Zeichen"
        aria-label="Währung suchen"
        className="w-full min-h-11 px-3.5 mb-2 rounded-klein bg-papier border border-strich focus:border-lavendel"
      />

      {liste.length === 0 ? (
        <p className="text-tinte-2 py-6 text-center">Nichts gefunden</p>
      ) : (
        <ul className="pb-2">
          {liste.map((w) => (
            <li key={w.code}>
              <button
                type="button"
                onClick={() => onWaehlen(w.code)}
                aria-current={w.code === aktuell ? 'true' : undefined}
                className={`w-full flex items-center gap-3 min-h-11 py-2 px-1 text-left trennstrich ${
                  w.code === aktuell ? 'font-bold' : ''
                }`}
              >
                <span className="w-9 shrink-0 font-mono text-tinte-2">{w.symbol}</span>
                <span className="flex-1 truncate">{w.de}</span>
                <span className="font-mono tabular text-sm text-tinte-2">{w.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
