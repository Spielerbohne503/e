import { useEffect, useRef, useState, type ReactNode } from 'react'
import { formatMoney } from '@/lib/format'

/**
 * The remaining animations from the design doc. Each one answers an action;
 * none of them run on scroll, and every one respects prefers-reduced-motion
 * by landing on its end state immediately rather than being skipped.
 */

function moechteRuhe(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * A receipt runs in from above and settles, as if it came out of a printer.
 * Only after a successful import — that is the moment it describes.
 */
export function BonEinzug({ children }: { children: ReactNode }) {
  const [ruhe] = useState(moechteRuhe)
  return (
    <div style={ruhe ? undefined : { animation: 'einzug 780ms var(--ease-zack) both' }}>{children}</div>
  )
}

/**
 * A single large total counts up. Never in lists — the design is explicit
 * that a page full of moving numbers is worse than a still one.
 */
export function Zahlenrolle({
  cents,
  currency,
  className = '',
}: {
  cents: number
  currency: string
  className?: string
}) {
  const [anzeige, setAnzeige] = useState(() => (moechteRuhe() ? cents : 0))
  const gelaufen = useRef(false)

  useEffect(() => {
    if (moechteRuhe() || gelaufen.current) {
      setAnzeige(cents)
      return
    }
    gelaufen.current = true

    const start = performance.now()
    const dauer = 600
    let laeuft = true

    const tick = (t: number) => {
      if (!laeuft) return
      const p = Math.min((t - start) / dauer, 1)
      // Ease-out cubic, the same curve the design demo uses.
      setAnzeige(Math.round(cents * (1 - (1 - p) ** 3)))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)

    return () => {
      laeuft = false
    }
  }, [cents])

  return (
    <span className={`font-mono tabular text-[38px] font-medium ${className}`}>
      {formatMoney(anzeige, currency)}
    </span>
  )
}

/**
 * Deleting crumples the card away, then leaves five seconds of undo.
 * Nothing is ever destroyed without a way back.
 */
export function Knuellbar({
  children,
  onEntfernen,
  beschreibung,
}: {
  /** Either plain content, or a render prop that receives the delete action. */
  children: ReactNode | ((loeschen: () => void) => ReactNode)
  onEntfernen: () => void
  /** Named in the undo bar, so it is clear what would come back. */
  beschreibung: string
}) {
  const [knuellt, setKnuellt] = useState(false)
  const [weg, setWeg] = useState(false)
  const timer = useRef<number | null>(null)

  const loeschen = () => {
    if (moechteRuhe()) {
      setWeg(true)
      starteRueckgaengig()
      return
    }
    setKnuellt(true)
    window.setTimeout(() => {
      setWeg(true)
      starteRueckgaengig()
    }, 520)
  }

  const starteRueckgaengig = () => {
    timer.current = window.setTimeout(() => {
      onEntfernen()
      timer.current = null
    }, 5000)
  }

  const zurueck = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
    setKnuellt(false)
    setWeg(false)
  }

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  if (weg) {
    return (
      <div className="flex items-center gap-3 py-3 trennstrich" role="status">
        <span className="flex-1 text-tinte-2 truncate">{beschreibung} entfernt</span>
        <button
          type="button"
          onClick={zurueck}
          className="tap-ziel min-h-9 px-3 rounded-pille bg-papier border border-strich text-sm font-bold"
        >
          Rückgängig
        </button>
      </div>
    )
  }

  return (
    <div style={knuellt ? { animation: 'knuellen 520ms cubic-bezier(.5,-0.2,.7,1) forwards' } : undefined}>
      {typeof children === 'function' ? children(loeschen) : children}
    </div>
  )
}

/**
 * A note that falls onto the page and stays slightly askew. Handwriting is
 * decoration only, so the readable copy lives in the aria-label.
 */
export function KlebeNotiz({
  text,
  farbe = 'bon',
}: {
  text: string
  farbe?: 'bon' | 'mint' | 'koralle' | 'lavendel'
}) {
  const [ruhe] = useState(moechteRuhe)
  const FARBEN = { bon: '#FFE873', mint: '#B9F0DA', koralle: '#FFC3B4', lavendel: '#DDD3FF' }

  return (
    <div role="note" aria-label={text}>
      <div
        aria-hidden="true"
        className="relative w-[190px] min-h-[120px] p-5 font-caveat text-[22px] leading-[1.32] text-[#2A3A2E]"
        style={{
          background: FARBEN[farbe],
          borderRadius: '1px 1px 3px 3px',
          transform: 'rotate(-2.2deg)',
          boxShadow: '1px 2px 0 rgba(14,59,51,.05), 7px 14px 24px rgba(14,59,51,.15)',
          animation: ruhe ? undefined : 'kleben 640ms var(--ease-zack) both',
        }}
      >
        {text}
        <span
          className="absolute right-0 bottom-0 w-0 h-0"
          style={{
            borderStyle: 'solid',
            borderWidth: '0 0 20px 20px',
            borderColor: 'transparent transparent rgba(255,255,255,.6) transparent',
            filter: 'drop-shadow(-2px -2px 2px rgba(14,59,51,.16))',
          }}
        />
      </div>
    </div>
  )
}
