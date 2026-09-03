/**
 * Shown while the server is unreachable. The app stays readable, but nothing
 * can be written — there is no offline queue by design, so saying so plainly
 * beats letting someone type into a form that will not save.
 */
export function VerbindungsHinweis() {
  return (
    <div
      role="status"
      className="mt-3 rounded-karte bg-bon-weich px-4 py-3 flex items-start gap-3"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="mt-1 shrink-0">
        <path
          d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 4v5m0 3h.01"
          stroke="currentColor"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      <div>
        <p className="font-bold">Keine Verbindung</p>
        <p className="text-sm text-tinte-2">
          Du siehst den letzten Stand. Ändern geht wieder, sobald die Verbindung steht.
        </p>
      </div>
    </div>
  )
}
