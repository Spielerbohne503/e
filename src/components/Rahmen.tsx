import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Marke } from './Marke'
import { IkonKnopf } from './Knopf'

/**
 * Page frame. Mobile first — everything works at 360px, content is capped
 * at a readable width on larger screens.
 */
export function Rahmen({
  titel,
  zurueck,
  aktion,
  children,
  kopfzeile,
}: {
  titel?: string
  /** Path for the back button. Omitted on the top-level screen. */
  zurueck?: string
  aktion?: ReactNode
  children: ReactNode
  /** Sticky content directly under the header, e.g. the budget bar. */
  kopfzeile?: ReactNode
}) {
  return (
    <div className="min-h-dvh">
      <header
        className="sticky top-0 z-30 backdrop-blur-sm"
        style={{
          background: 'color-mix(in srgb, var(--papier) 88%, transparent)',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <div className="mx-auto max-w-[680px] px-4 py-2.5 flex items-center gap-2 min-h-[60px]">
          {zurueck ? (
            <Link
              to={zurueck}
              aria-label="Zurück"
              className="inline-grid place-items-center w-11 h-11 -ml-2 rounded-pille text-tinte-2 hover:text-tinte active:scale-90 transition-transform duration-[--dauer-tipp]"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M15 5l-7 7 7 7"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          ) : (
            <Link to="/" aria-label="quitt — Startseite" className="inline-flex items-center gap-2">
              <Marke groesse={30} />
            </Link>
          )}
          <h1 className="flex-1 text-[21px] font-medium truncate">{titel ?? 'quitt'}</h1>
          {aktion}
        </div>
        {kopfzeile}
      </header>
      <main
        className="mx-auto max-w-[680px] px-4 pb-24"
        style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}
      >
        {children}
      </main>
    </div>
  )
}

/** A floating primary action, anchored above the safe area. */
export function SchwebeAktion({ children }: { children: ReactNode }) {
  return (
    <div
      className="fixed inset-x-0 z-20 flex justify-center px-4 pointer-events-none"
      style={{ bottom: 'max(16px, env(safe-area-inset-bottom))' }}
    >
      <div className="w-full max-w-[680px] pointer-events-auto flex justify-end gap-2">{children}</div>
    </div>
  )
}

export { IkonKnopf }
