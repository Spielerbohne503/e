import type { ReactNode } from 'react'

/**
 * Paper details, all drawn as SVG or CSS — no image files anywhere, per the
 * design doc. Everything here is decoration and carries `aria-hidden`, so a
 * screen reader never has to wade through it.
 */

/* ------------------------------------------------------------------ *
 * Category stamps
 * ------------------------------------------------------------------ */

const KATEGORIE_PFADE: Record<string, ReactNode> = {
  // A shopping bag with a fold across the top.
  lebensmittel: (
    <>
      <path d="M5 8h14l-1.2 11.5H6.2z" />
      <path d="M9 8V6.2a3 3 0 0 1 6 0V8" />
    </>
  ),
  // A bottle with a narrow neck.
  getraenke: (
    <>
      <path d="M10 3.5h4v3l2 3v11h-8V9.5l2-3z" />
      <path d="M8 13h8" />
    </>
  ),
  // A house outline.
  haushalt: (
    <>
      <path d="M4 11 12 4.5l8 6.5" />
      <path d="M6.5 10.5V20h11v-9.5" />
    </>
  ),
  // A tube with a cap.
  drogerie: (
    <>
      <path d="M9.5 3.5h5v3h-5z" />
      <path d="M8 6.5h8l-1 13.5H9z" />
    </>
  ),
  // Fork and knife.
  restaurant: (
    <>
      <path d="M8 3.5v7M6 3.5v4.5a2 2 0 0 0 4 0V3.5M8 10.5V20" />
      <path d="M16.5 3.5c-1.5 1.5-1.5 6 0 7V20" />
    </>
  ),
  // A car seen from the side.
  transport: (
    <>
      <path d="M4 15.5 5.8 9.8A2 2 0 0 1 7.7 8.4h8.6a2 2 0 0 1 1.9 1.4L20 15.5" />
      <path d="M3.5 15.5h17V19h-2.5v-1.5h-12V19H3.5z" />
    </>
  ),
  // A ticket with a torn edge.
  freizeit: (
    <>
      <path d="M4 8h16v3a1.8 1.8 0 0 0 0 3.6V18H4v-3.4a1.8 1.8 0 0 0 0-3.6z" />
      <path d="M12 8.5v1.8M12 13v1.8M12 16.2V18" />
    </>
  ),
  // A plain tag.
  sonstiges: (
    <>
      <path d="M4.5 4.5h7.5l7.5 7.5-7.5 7.5-7.5-7.5z" />
      <circle cx="8.6" cy="8.6" r="1.4" />
    </>
  ),
}

/**
 * A category, drawn as if stamped onto the receipt: single stroke weight,
 * rounded ends, slightly askew. Falls back to the generic tag.
 */
export function KategorieStempel({
  kategorie,
  groesse = 20,
  className = '',
}: {
  kategorie: string | null
  groesse?: number
  className?: string
}) {
  const pfad = KATEGORIE_PFADE[kategorie ?? 'sonstiges'] ?? KATEGORIE_PFADE.sonstiges

  return (
    <svg
      width={groesse}
      height={groesse}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: 'rotate(-2deg)' }}
    >
      {pfad}
    </svg>
  )
}

/* ------------------------------------------------------------------ *
 * Paper edges and fasteners
 * ------------------------------------------------------------------ */

/**
 * The punched holes of a tear-off pad, along the top edge of a card.
 * Two rows: the hole itself and the shadow inside it.
 */
export function Perforation({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute left-0 right-0 top-0 h-2 pointer-events-none ${className}`}
      style={{
        backgroundImage:
          'radial-gradient(circle at 50% 0, var(--papier) 0 3.5px, transparent 3.5px)',
        backgroundSize: '14px 8px',
        backgroundRepeat: 'repeat-x',
      }}
    />
  )
}

/**
 * A folded corner, bottom right. Same construction the design doc uses for
 * the sticky note: one light triangle with the shadow falling up and left,
 * which is what makes the eye read it as lifted paper.
 */
export function Eselsohr({ groesse = 20 }: { groesse?: number }) {
  return (
    <span
      aria-hidden="true"
      className="absolute right-0 bottom-0 w-0 h-0 pointer-events-none"
      style={{
        borderStyle: 'solid',
        borderWidth: `0 0 ${groesse}px ${groesse}px`,
        borderColor: 'transparent transparent rgba(255, 255, 255, 0.72) transparent',
        filter: 'drop-shadow(-2px -2px 2px rgba(14, 59, 51, 0.16))',
      }}
    />
  )
}

/** A paper clip over the top edge. Metal, so it never rotates or animates. */
export function Klammer({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="48"
      viewBox="0 0 22 48"
      className={`absolute -top-2 left-6 z-10 pointer-events-none ${className}`}
      style={{ transform: 'rotate(-6deg)' }}
    >
      {/* The shadow it casts on the paper below. */}
      <path
        d="M6.5 40V10a4.5 4.5 0 0 1 9 0v26a2.5 2.5 0 0 1-5 0V13"
        fill="none"
        stroke="rgba(14,59,51,.18)"
        strokeWidth="3.4"
        strokeLinecap="round"
        transform="translate(1.2 1.6)"
      />
      <path
        d="M6.5 40V10a4.5 4.5 0 0 1 9 0v26a2.5 2.5 0 0 1-5 0V13"
        fill="none"
        stroke="#9AA6A2"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* A highlight along one edge, so it looks bent rather than drawn. */}
      <path
        d="M6.5 38V10a4.5 4.5 0 0 1 4-4.5"
        fill="none"
        stroke="#D6DEDB"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * The wavy bottom edge of a till roll. Sits under a card and reads as the
 * receipt continuing past the fold.
 */
export function Rollenkante({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block h-3 ${className}`}
      style={{
        background: 'var(--karte)',
        clipPath:
          'polygon(0 0, 100% 0, 100% 40%, 96% 100%, 92% 40%, 88% 100%, 84% 40%, 80% 100%, 76% 40%, 72% 100%, 68% 40%, 64% 100%, 60% 40%, 56% 100%, 52% 40%, 48% 100%, 44% 40%, 40% 100%, 36% 40%, 32% 100%, 28% 40%, 24% 100%, 20% 40%, 16% 100%, 12% 40%, 8% 100%, 4% 40%, 0 100%)',
      }}
    />
  )
}

/* ------------------------------------------------------------------ *
 * Rubber stamps
 * ------------------------------------------------------------------ */

/**
 * A rubber stamp for a state that is already settled — the small sibling of
 * the quitt stamp, without the confetti, so the big moment stays unique.
 */
export function Gummistempel({
  text,
  farbe = 'mint',
  className = '',
}: {
  text: string
  farbe?: 'mint' | 'koralle' | 'lavendel'
  className?: string
}) {
  const FARBEN = {
    mint: { rand: 'var(--mint)', tinte: 'var(--mint)' },
    koralle: { rand: 'var(--koralle)', tinte: 'var(--koralle)' },
    lavendel: { rand: 'var(--lavendel)', tinte: 'var(--lavendel)' },
  }[farbe]

  return (
    <span
      aria-hidden="true"
      className={`inline-block font-fredoka font-semibold text-[11px] uppercase tracking-[0.12em] px-2 py-0.5 ${className}`}
      style={{
        color: FARBEN.tinte,
        border: `2px solid ${FARBEN.rand}`,
        borderRadius: '6px',
        transform: 'rotate(-4deg)',
        // Slightly uneven ink, the way a real stamp never prints evenly.
        opacity: 0.82,
      }}
    >
      {text}
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * Backgrounds
 * ------------------------------------------------------------------ */

/**
 * A faint watermark for large empty areas. Deliberately weak — it must never
 * compete with the content, and never sits behind an amount.
 */
export function Wasserzeichen({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 grid place-items-center pointer-events-none overflow-hidden"
      style={{ opacity: 0.045 }}
    >
      {children}
    </span>
  )
}

/**
 * Squared paper, for areas that read as a notepad. Used behind charts, never
 * behind figures.
 */
export function KaroFlaeche({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(var(--strich) 1px, transparent 1px), linear-gradient(90deg, var(--strich) 1px, transparent 1px)',
        backgroundSize: '22px 22px',
        backgroundPosition: '-1px -1px',
      }}
    >
      {children}
    </div>
  )
}
