/** The quitt mark: a mint strip over a torn-off bon in bon yellow. */
export function Marke({ groesse = 36 }: { groesse?: number }) {
  return (
    <svg width={groesse} height={groesse} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="6" y="13" width="36" height="8" rx="4" fill="#00B37E" />
      <path
        d="M6 31q0-4 4-4h28q4 0 4 4v8l-2.25-4-2.25 4-2.25-4-2.25 4-2.25-4-2.25 4-2.25-4-2.25 4-2.25-4-2.25 4-2.25-4-2.25 4-2.25-4-2.25 4-2.25-4L6 39z"
        fill="#FFC947"
      />
    </svg>
  )
}
