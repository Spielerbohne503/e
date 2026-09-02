import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useId } from 'react'

const EINGABE =
  'w-full min-h-11 px-3.5 py-2.5 rounded-klein bg-papier text-tinte placeholder:text-tinte-2/60 ' +
  'border border-strich transition-colors duration-[--dauer-tipp] focus:border-lavendel'

export function Feld({
  label,
  hinweis,
  fehler,
  mono,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hinweis?: ReactNode
  fehler?: string | null
  mono?: boolean
}) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-bold mb-1.5">
        {label}
      </label>
      <input
        id={id}
        className={`${EINGABE} ${mono ? 'font-mono tabular' : ''} ${fehler ? 'border-fehler' : ''}`}
        aria-invalid={fehler ? true : undefined}
        aria-describedby={fehler || hinweis ? `${id}-hint` : undefined}
        {...rest}
      />
      {(fehler || hinweis) && (
        <p id={`${id}-hint`} className={`text-sm mt-1.5 ${fehler ? 'text-fehler' : 'text-tinte-2'}`}>
          {fehler ?? hinweis}
        </p>
      )}
    </div>
  )
}

export function Auswahl({
  label,
  hinweis,
  children,
  className = '',
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hinweis?: ReactNode }) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-bold mb-1.5">
        {label}
      </label>
      <select id={id} className={EINGABE} {...rest}>
        {children}
      </select>
      {hinweis && <p className="text-sm mt-1.5 text-tinte-2">{hinweis}</p>}
    </div>
  )
}

export function Textfeld({
  label,
  hinweis,
  className = '',
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hinweis?: ReactNode }) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-bold mb-1.5">
        {label}
      </label>
      <textarea id={id} className={`${EINGABE} min-h-24 resize-y`} {...rest} />
      {hinweis && <p className="text-sm mt-1.5 text-tinte-2">{hinweis}</p>}
    </div>
  )
}

/** A pill-shaped segmented control. Keyboard operable, one tab stop per option. */
export function Umschalter<T extends string>({
  label,
  wert,
  optionen,
  onWechsel,
  className = '',
}: {
  label: string
  wert: T
  optionen: ReadonlyArray<{ wert: T; text: string }>
  onWechsel: (w: T) => void
  className?: string
}) {
  return (
    <div className={className} role="group" aria-label={label}>
      <div className="inline-flex flex-wrap max-w-full p-1 rounded-pille bg-papier border border-strich gap-1">
        {optionen.map((o) => (
          <button
            key={o.wert}
            type="button"
            aria-pressed={wert === o.wert}
            onClick={() => onWechsel(o.wert)}
            className={`tap-ziel min-h-9 px-3.5 rounded-pille text-sm font-bold transition-colors duration-[--dauer-tipp] ${
              wert === o.wert ? 'bg-knopf text-knopf-tinte' : 'text-tinte-2'
            }`}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  )
}

/** A labelled on/off switch. */
export function Schalter({
  label,
  beschreibung,
  an,
  onWechsel,
}: {
  label: string
  beschreibung?: string
  an: boolean
  onWechsel: (an: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex-1">
        <label htmlFor={id} className="font-bold">
          {label}
        </label>
        {beschreibung && <p className="text-sm text-tinte-2 leading-snug">{beschreibung}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={an}
        onClick={() => onWechsel(!an)}
        className={`tap-ziel shrink-0 w-[52px] h-8 rounded-pille transition-colors duration-[--dauer-standard] ${
          an ? 'bg-mint' : 'bg-strich'
        }`}
      >
        <span
          className="absolute top-1 left-1 w-6 h-6 rounded-pille bg-white shadow-ruhe transition-transform duration-[--dauer-standard] ease-zack"
          style={{ transform: an ? 'translateX(20px)' : 'none' }}
        />
      </button>
    </div>
  )
}
