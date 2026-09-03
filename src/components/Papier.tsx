import type { ReactNode, HTMLAttributes } from 'react'

/**
 * The three paper stocks. They are never mixed: an element is a Bon,
 * a Zettel or a Karteikarte, and each one has a fixed job.
 */

type PapierProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  /** Tear-off edge along the bottom, as if pulled from a printer. */
  abriss?: boolean
  /** A strip of tape across the top edge. */
  band?: 'bon' | 'mint'
  /** Slight rotation. Never more than three tilted elements per screen. */
  kipp?: 'l' | 'r'
  className?: string
}

const kippClass = { l: 'kipp-l', r: 'kipp-r' } as const

/** The default surface: a white card with paper fibre and a soft shadow. */
export function Papier({ children, abriss, band, kipp, className = '', ...rest }: PapierProps) {
  return (
    <div
      className={[
        'relative bg-karte shadow-ruhe papier-faser',
        abriss ? 'rounded-t-karte rounded-b-none mb-3.5 abriss' : 'rounded-karte',
        kipp ? kippClass[kipp] : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {band && (
        <span
          aria-hidden="true"
          className="band"
          style={band === 'mint' ? { background: 'rgba(150,232,204,.6)' } : undefined}
        />
      )}
      {children}
    </div>
  )
}

/**
 * Bon-Streifen — the line item list. Monospace, dashed rules, tear-off edge.
 * This is where the actual work happens, so it carries the least decoration.
 */
export function Bon({ children, className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`relative bg-karte rounded-t-karte rounded-b-none shadow-ruhe abriss mb-3.5 ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}

/** One row on a Bon. Dashed separator, amount right-aligned in mono. */
export function BonZeile({
  children,
  className = '',
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex items-center gap-3 py-3 trennstrich last:border-b-0 ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}

/**
 * Karteikarte — a single receipt in the overview. Red header rule,
 * blue ruled lines, almost no radius. Reads as a document at a glance.
 */
export function Karteikarte({
  children,
  kipp,
  className = '',
  ...rest
}: HTMLAttributes<HTMLDivElement> & { kipp?: 'l' | 'r' }) {
  return (
    <div
      className={[
        'relative rounded-[3px] p-4 shadow-ruhe',
        kipp ? kippClass[kipp] : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        background: 'var(--karteikarte-grund)',
        borderTop: '3px solid var(--karteikarte-kopf)',
        backgroundImage:
          'repeating-linear-gradient(transparent 0 25px, var(--karteikarte-linie) 25px 26px)',
        backgroundPosition: '0 22px',
      }}
      {...rest}
    >
      {children}
    </div>
  )
}

const ZETTEL_FARBEN = {
  bon: '#FFE873',
  mint: '#B9F0DA',
  koralle: '#FFC3B4',
  lavendel: '#DDD3FF',
} as const

export type ZettelFarbe = keyof typeof ZETTEL_FARBEN

/**
 * Klebezettel — handwritten additions only. Caveat, slightly askew,
 * never more than one per screen. The handwriting is decoration, so the
 * text is repeated for assistive tech only when it carries meaning.
 */
export function Zettel({
  children,
  farbe = 'bon',
  klein,
  klebt,
  className = '',
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  farbe?: ZettelFarbe
  klein?: boolean
  /** Plays the "falls onto the page" animation once on mount. */
  klebt?: boolean
}) {
  return (
    <div
      className={[
        'relative font-caveat leading-[1.32] text-[#2A3A2E]',
        klein ? 'w-[136px] min-h-[112px] text-[19px] p-[14px_14px_20px]' : 'w-[190px] min-h-[170px] text-[22px] p-[20px_18px_26px]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        background: ZETTEL_FARBEN[farbe],
        borderRadius: '1px 1px 3px 3px',
        transform: 'rotate(-2.2deg)',
        boxShadow: '1px 2px 0 rgba(14,59,51,.05), 7px 14px 24px rgba(14,59,51,.15)',
        animation: klebt ? 'kleben 640ms var(--ease-zack) both' : undefined,
      }}
      {...rest}
    >
      {children}
      <span
        aria-hidden="true"
        className="absolute right-0 bottom-0 w-0 h-0"
        style={{
          borderStyle: 'solid',
          borderWidth: '0 0 20px 20px',
          borderColor: 'transparent transparent rgba(255,255,255,.6) transparent',
          filter: 'drop-shadow(-2px -2px 2px rgba(14,59,51,.16))',
        }}
      />
    </div>
  )
}

/**
 * A margin note in handwriting. Pure decoration — it never carries the
 * only copy of a fact, so it is hidden from assistive technology.
 */
export function Handnotiz({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p
      aria-hidden="true"
      className={`font-caveat text-[21px] leading-[1.3] ${className}`}
      style={{ transform: "rotate(-1.1deg)", color: "var(--hand-farbe)" }}
    >
      {children}
    </p>
  )
}
