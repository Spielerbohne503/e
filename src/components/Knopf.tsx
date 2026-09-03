import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useSanfteNavigation } from '@/lib/seitenwechsel'

type Art = 'primaer' | 'zweit' | 'geist' | 'gefahr'

/** Tap targets are at least 44px everywhere. */
const BASIS =
  'inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-pille font-fredoka font-medium ' +
  'transition-transform duration-[--dauer-tipp] ease-weich active:scale-95 disabled:opacity-45 ' +
  'disabled:pointer-events-none select-none'

const ARTEN: Record<Art, string> = {
  primaer: 'bg-knopf text-knopf-tinte shadow-ruhe',
  zweit: 'bg-karte text-tinte shadow-ruhe',
  geist: 'bg-transparent text-tinte-2 hover:text-tinte',
  // Reserved for destructive actions — a debt is never rendered in this colour.
  gefahr: 'bg-fehler-weich text-fehler',
}

type KnopfProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  art?: Art
  breit?: boolean
  children: ReactNode
}

export function Knopf({ art = 'primaer', breit, className = '', children, ...rest }: KnopfProps) {
  return (
    <button
      type="button"
      className={[BASIS, ARTEN[art], breit ? 'w-full' : '', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}

export function KnopfLink({
  to,
  art = 'primaer',
  breit,
  className = '',
  children,
}: {
  to: string
  art?: Art
  breit?: boolean
  className?: string
  children: ReactNode
}) {
  const navigiere = useSanfteNavigation()

  // An anchor, so middle-click and "open in new tab" keep working, but the
  // plain click goes through the view transition.
  return (
    <a
      href={to}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        navigiere(to)
      }}
      className={[BASIS, ARTEN[art], breit ? 'w-full' : '', className].filter(Boolean).join(' ')}
    >
      {children}
    </a>
  )
}

/** A round icon button, e.g. back or close. Always carries an aria-label. */
export function IkonKnopf({
  label,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`inline-grid place-items-center w-11 h-11 rounded-pille text-tinte-2 hover:text-tinte transition-transform duration-[--dauer-tipp] ease-weich active:scale-90 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
