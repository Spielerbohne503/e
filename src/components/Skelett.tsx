/**
 * No spinner. An empty receipt whose lines shimmer — the same shape that is
 * about to be filled with content.
 */
export function Skelett({ zeilen = 4, className = '' }: { zeilen?: number; className?: string }) {
  const breiten = ['100%', '70%', '85%', '60%', '92%', '75%']
  return (
    <div className={className} role="status" aria-label="Lädt">
      {Array.from({ length: zeilen }, (_, i) => (
        <span
          key={i}
          className="block h-[11px] rounded-md mb-2.5"
          style={{
            width: breiten[i % breiten.length],
            background:
              'linear-gradient(90deg, var(--punkt-1) 25%, var(--strich) 37%, var(--punkt-1) 63%)',
            backgroundSize: '400% 100%',
            animation: 'schimmer 1.4s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  )
}
