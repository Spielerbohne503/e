import { useEffect, useRef, type ReactNode } from 'react'
import { IkonKnopf } from './Knopf'

/**
 * Bottom sheet. Slides up in 320ms with ease-zack, closes on Escape,
 * on a click outside, or via the close button. Focus is trapped inside
 * while it is open and returned to the trigger afterwards.
 */
export function Sheet({
  offen,
  titel,
  onSchliessen,
  children,
  fussleiste,
}: {
  offen: boolean
  titel: string
  onSchliessen: () => void
  children: ReactNode
  fussleiste?: ReactNode
}) {
  const blattRef = useRef<HTMLDivElement>(null)
  const vorherFokussiert = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!offen) return
    vorherFokussiert.current = document.activeElement as HTMLElement | null

    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onSchliessen()
        return
      }
      if (e.key !== 'Tab' || !blattRef.current) return
      const ziele = blattRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (ziele.length === 0) return
      const erstes = ziele[0]!
      const letztes = ziele[ziele.length - 1]!
      if (e.shiftKey && document.activeElement === erstes) {
        e.preventDefault()
        letztes.focus()
      } else if (!e.shiftKey && document.activeElement === letztes) {
        e.preventDefault()
        erstes.focus()
      }
    }

    document.addEventListener('keydown', beiTaste)
    const vorherOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Move focus into the sheet so a keyboard reader lands in the right place.
    requestAnimationFrame(() => {
      blattRef.current?.querySelector<HTMLElement>('input, button, [tabindex]')?.focus()
    })

    return () => {
      document.removeEventListener('keydown', beiTaste)
      document.body.style.overflow = vorherOverflow
      vorherFokussiert.current?.focus()
    }
  }, [offen, onSchliessen])

  if (!offen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(14,59,51,.34)', animation: 'schleier var(--dauer-sheet) ease-out' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSchliessen()
      }}
    >
      <div
        ref={blattRef}
        role="dialog"
        aria-modal="true"
        aria-label={titel}
        className="w-full max-w-[560px] bg-karte rounded-t-gross shadow-hoch max-h-[88dvh] flex flex-col"
        style={{ animation: 'hoch var(--dauer-sheet) var(--ease-zack) both' }}
      >
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 shrink-0">
          <span
            aria-hidden="true"
            className="absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1 rounded-pille"
            style={{ background: 'var(--strich)' }}
          />
          <h2 className="flex-1 text-[19px] font-medium pt-2">{titel}</h2>
          <IkonKnopf label="Schließen" onClick={onSchliessen}>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </IkonKnopf>
        </div>
        <div className="px-4 pb-2 overflow-y-auto flex-1">{children}</div>
        {fussleiste && (
          <div
            className="px-4 py-3 shrink-0 border-t"
            style={{ borderColor: 'var(--strich)', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
          >
            {fussleiste}
          </div>
        )}
      </div>
    </div>
  )
}
