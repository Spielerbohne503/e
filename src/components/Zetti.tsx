import { useState } from 'react'

/**
 * Zetti — a receipt strip with a face. He appears at exactly three places:
 * an empty state, a finished settlement, and a failed import. He does not
 * talk, has no speech bubbles and gives no tips. Switchable off in settings.
 */
export function Zetti({
  groesse = 110,
  className = '',
}: {
  groesse?: number
  className?: string
}) {
  const [winkt, setWinkt] = useState(false)

  return (
    <svg
      width={groesse}
      height={(groesse / 110) * 140}
      viewBox="0 0 110 140"
      role="img"
      aria-label="Zetti, das Bon-Maskottchen"
      className={`cursor-pointer ${className}`}
      onClick={() => {
        setWinkt(false)
        requestAnimationFrame(() => setWinkt(true))
        setTimeout(() => setWinkt(false), 1500)
      }}
    >
      <path
        d="M22 16q0-8 8-8h50q8 0 8 8v104l-5.5-8-5.5 8-5.5-8-5.5 8-5.5-8-5.5 8-5.5-8-5.5 8-5.5-8-5.5 8-5.5-8L22 128z"
        fill="var(--karte)"
        stroke="var(--nacht)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <g style={{ transformOrigin: 'center', animation: 'blinzeln 5.2s infinite' }}>
        <circle cx="44" cy="52" r="5.5" fill="var(--nacht)" />
      </g>
      <g style={{ transformOrigin: 'center', animation: 'blinzeln 5.2s infinite' }}>
        <circle cx="68" cy="52" r="5.5" fill="var(--nacht)" />
      </g>
      <path d="M46 70q9 8 20 0" stroke="var(--nacht)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <rect x="36" y="88" width="40" height="5" rx="2.5" fill="var(--mint-weich)" />
      <rect x="36" y="99" width="26" height="5" rx="2.5" fill="var(--mint-weich)" />
      <g
        style={{
          transformOrigin: '88px 60px',
          animation: winkt ? 'winken 700ms ease-in-out 2' : undefined,
        }}
      >
        <rect x="86" y="56" width="18" height="7" rx="3.5" fill="var(--nacht)" />
      </g>
    </svg>
  )
}

/**
 * The empty state. Zetti plus a short line — no tips, no call to action
 * beyond the button the caller passes in.
 */
export function LeerZustand({
  text,
  zettiAn = true,
  children,
}: {
  text: string
  zettiAn?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4 gap-4">
      {zettiAn && (
        <div className="relative">
          {/* A blank pad behind him, so the empty state looks like paper
              waiting to be filled rather than a hole in the page. */}
          <span
            aria-hidden="true"
            className="absolute -z-10 left-1/2 top-4 -translate-x-1/2 w-[132px] h-[118px] rounded-[3px]"
            style={{
              background: 'var(--karte)',
              boxShadow: 'var(--schatten-ruhe)',
              transform: 'translateX(-50%) rotate(-5deg)',
            }}
          />
          <span
            aria-hidden="true"
            className="absolute -z-10 left-1/2 top-2 -translate-x-1/2 w-[132px] h-[118px] rounded-[3px]"
            style={{
              background: 'var(--karte)',
              boxShadow: 'var(--schatten-ruhe)',
              transform: 'translateX(-50%) rotate(2.5deg)',
            }}
          />
          <Zetti groesse={96} />
        </div>
      )}
      <p className="text-tinte-2 max-w-[32ch]">{text}</p>
      {children}
    </div>
  )
}
