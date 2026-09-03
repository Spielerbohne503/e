import { formatMoney, formatSigned } from '@/lib/format'

/**
 * Amounts stand still. Monospace, tabular figures, no texture behind them,
 * never animated — except a single large total, which has its own component.
 */
export function Betrag({
  cents,
  currency = 'EUR',
  gross,
  className = '',
}: {
  cents: number
  currency?: string
  gross?: boolean
  className?: string
}) {
  return (
    <span
      className={`font-mono tabular ${gross ? 'text-[28px] font-medium' : 'font-medium'} ${className}`}
    >
      {formatMoney(cents, currency)}
    </span>
  )
}

/**
 * A balance. Mint means you get money back, koralle means you owe —
 * and the sign carries the same information, so colour is never alone.
 */
export function Saldo({
  cents,
  currency = 'EUR',
  className = '',
}: {
  cents: number
  currency?: string
  className?: string
}) {
  const ton = cents > 0 ? 'text-mint' : cents < 0 ? 'text-koralle' : 'text-tinte-2'
  return (
    <span className={`font-mono tabular font-medium ${ton} ${className}`}>
      {formatSigned(cents, currency)}
    </span>
  )
}
