import { useEffect, useRef, useState } from 'react'
import { initial, textOn } from '@/lib/colors'

export type PersonAnzeige = { id: string; display_name: string; color: string }

/**
 * A person is always their colour *and* their initial — colour alone never
 * carries meaning. Tapping toggles them on a line item and plays "hopp".
 */
export function PersonChip({
  person,
  aktiv = true,
  onClick,
  gross,
  className = '',
}: {
  person: PersonAnzeige
  aktiv?: boolean
  onClick?: () => void
  gross?: boolean
  className?: string
}) {
  const [huepft, setHuepft] = useState(false)
  const ersterLauf = useRef(true)

  // Only animate in response to a change the reader caused, never on mount.
  useEffect(() => {
    if (ersterLauf.current) {
      ersterLauf.current = false
      return
    }
    setHuepft(true)
    const t = setTimeout(() => setHuepft(false), 420)
    return () => clearTimeout(t)
  }, [aktiv])

  const groesse = gross ? 'w-11 h-11 text-base' : 'w-[42px] h-[42px] text-[15px]'
  const inhalt = initial(person.display_name)

  const style = aktiv
    ? { background: person.color, color: textOn(person.color) }
    : { background: 'transparent', color: 'var(--tinte-2)', boxShadow: `inset 0 0 0 2px ${person.color}66` }

  const Tag = onClick ? 'button' : 'span'

  return (
    <Tag
      {...(onClick
        ? {
            type: 'button' as const,
            onClick,
            'aria-pressed': aktiv,
            'aria-label': `${person.display_name}${aktiv ? ' beteiligt' : ' nicht beteiligt'}`,
          }
        : { 'aria-hidden': 'true' as const })}
      className={`grid place-items-center rounded-pille font-fredoka font-medium shrink-0 transition-transform duration-[--dauer-tipp] ease-weich ${onClick ? 'active:scale-90 cursor-pointer' : ''} ${groesse} ${className}`}
      style={{ ...style, animation: huepft ? 'hopp 420ms var(--ease-zack)' : undefined }}
    >
      {inhalt}
    </Tag>
  )
}

/** Chip plus name, for lists where the full name should be readable. */
export function PersonZeile({
  person,
  rechts,
  className = '',
}: {
  person: PersonAnzeige
  rechts?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <PersonChip person={person} />
      <span className="flex-1 font-bold truncate">{person.display_name}</span>
      {rechts}
    </div>
  )
}
