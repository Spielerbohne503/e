import { useEffect, useRef, useState } from 'react'

const KONFETTI_FARBEN = ['#00B37E', '#FFC947', '#FF6B4A', '#7C5CFF']

type Schnipsel = { id: number; farbe: string; dx: string; dy: string; dr: string }

/**
 * The one celebration in the app: the quitt stamp with confetti, shown when
 * every balance is zero. Exactly once per settlement — the caller guards that.
 */
export function QuittStempel({ spielen = true }: { spielen?: boolean }) {
  const [schnipsel, setSchnipsel] = useState<Schnipsel[]>([])
  const gelaufen = useRef(false)

  useEffect(() => {
    if (!spielen || gelaufen.current) return
    gelaufen.current = true

    const reduziert = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduziert) return

    const t = setTimeout(() => {
      setSchnipsel(
        Array.from({ length: 22 }, (_, i) => ({
          id: i,
          farbe: KONFETTI_FARBEN[i % 4]!,
          dx: `${Math.round(Math.random() * 260 - 130)}px`,
          dy: `${Math.round(Math.random() * -150 - 30)}px`,
          dr: `${Math.round(Math.random() * 720 - 360)}deg`,
        })),
      )
    }, 240)
    return () => clearTimeout(t)
  }, [spielen])

  return (
    <div className="relative grid place-items-center py-8" role="status">
      {schnipsel.map((s) => (
        <span
          key={s.id}
          aria-hidden="true"
          className="absolute w-2 h-3.5 rounded-[2px] left-1/2 top-1/2"
          style={
            {
              background: s.farbe,
              opacity: 0,
              animation: 'fliegen 1100ms cubic-bezier(.2,.6,.4,1) forwards',
              '--dx': s.dx,
              '--dy': s.dy,
              '--dr': s.dr,
            } as React.CSSProperties
          }
        />
      ))}
      <span
        className="relative inline-block font-fredoka font-semibold text-[30px] text-mint bg-mint-weich px-6 py-2"
        style={{
          border: '4px solid var(--mint)',
          borderRadius: '16px',
          animation: spielen ? 'stempeln 620ms var(--ease-zack) both' : undefined,
          transform: 'rotate(-7deg)',
        }}
      >
        quitt!
      </span>
    </div>
  )
}

/** A check mark that draws itself. Calmer than a bounce, and it reads as done. */
export function Haken({ groesse = 76 }: { groesse?: number }) {
  return (
    <svg width={groesse} height={groesse} viewBox="0 0 76 76" aria-hidden="true">
      <circle
        cx="38"
        cy="38"
        r="27"
        fill="none"
        stroke="var(--mint)"
        strokeWidth="5"
        strokeLinecap="round"
        transform="rotate(-90 38 38)"
        style={{
          strokeDasharray: 170,
          strokeDashoffset: 170,
          animation: 'zeichnen 480ms var(--ease-weich) forwards',
        }}
      />
      <path
        d="M26 39l9 9 16-18"
        fill="none"
        stroke="var(--mint)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 44,
          strokeDashoffset: 44,
          animation: 'zeichnen 320ms var(--ease-weich) 320ms forwards',
        }}
      />
    </svg>
  )
}
