import { useState } from 'react'

/**
 * Shown while the app runs against local storage because the Worker has no
 * database yet. Everything works — only sync between devices does not, and
 * the data lives in this browser.
 *
 * Factual, dismissible, and gone for good once D1 is configured.
 */
export function LokalHinweis() {
  const [versteckt, setVersteckt] = useState(
    () => sessionStorage.getItem('quitt.lokalhinweis') === 'weg',
  )

  if (versteckt) return null

  return (
    <div className="mt-4 rounded-karte bg-bon-weich px-4 py-3" role="status">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="font-bold">Läuft auf diesem Gerät</p>
          <p className="text-sm text-tinte-2 mt-0.5">
            Alles funktioniert, die Daten liegen aber nur in diesem Browser. Für den Sync auf
            mehrere Geräte fehlt noch die Datenbank — siehe README.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem('quitt.lokalhinweis', 'weg')
            setVersteckt(true)
          }}
          aria-label="Hinweis ausblenden"
          className="shrink-0 grid place-items-center w-11 h-11 -mr-2 -mt-1 rounded-pille text-tinte-2"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
