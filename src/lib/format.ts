/**
 * All number and date formatting goes through Intl — never hand-rolled.
 * Amounts are integers in the smallest currency unit everywhere in the app;
 * these helpers are the only place they turn into text.
 */

import { decimalsFor, minorUnitFactor } from '@/core/currency'

const LOCALE = 'de-DE'

// Currency precision lives in the core, so the calculation layer stays
// self-contained; the formatters here just re-export it for convenience.
export { decimalsFor, minorUnitFactor } from '@/core/currency'

const moneyCache = new Map<string, Intl.NumberFormat>()

function moneyFormatter(currency: string, withSymbol: boolean): Intl.NumberFormat {
  const key = `${currency}:${withSymbol}`
  let fmt = moneyCache.get(key)
  if (!fmt) {
    const digits = decimalsFor(currency)
    fmt = new Intl.NumberFormat(LOCALE, {
      style: withSymbol ? 'currency' : 'decimal',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
    moneyCache.set(key, fmt)
  }
  return fmt
}

/** 349 EUR -> "3,49 €". Uses a real minus sign for negatives. */
export function formatMoney(cents: number, currency = 'EUR'): string {
  return moneyFormatter(currency, true).format(cents / minorUnitFactor(currency))
}

/** 349 EUR -> "3,49" (no symbol) — for inputs and CSV. */
export function formatAmount(cents: number, currency = 'EUR'): string {
  return moneyFormatter(currency, false).format(cents / minorUnitFactor(currency))
}

/** Always shows a sign: "+12,40 €" / "−7,15 €" / "0,00 €". */
export function formatSigned(cents: number, currency = 'EUR'): string {
  if (cents === 0) return formatMoney(0, currency)
  const body = formatMoney(Math.abs(cents), currency)
  return `${cents > 0 ? '+' : '−'}${body}`
}

/**
 * Parses user input into minor units. Accepts both "3,49" and "3.49",
 * thousands separators, and a leading currency symbol.
 * Returns null when the input is not a number.
 */
export function parseAmount(input: string, currency = 'EUR'): number | null {
  const cleaned = input
    .replace(/[^\d,.\-−]/g, '')
    .replace(/−/g, '-')
    .trim()
  if (cleaned === '' || cleaned === '-') return null

  // The last separator is the decimal one; everything before it is grouping.
  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  const cut = Math.max(lastComma, lastDot)

  let normalised: string
  if (cut === -1) {
    normalised = cleaned
  } else {
    const head = cleaned.slice(0, cut).replace(/[.,]/g, '')
    const tail = cleaned.slice(cut + 1).replace(/[.,]/g, '')
    normalised = `${head}.${tail}`
  }

  const value = Number(normalised)
  if (!Number.isFinite(value)) return null
  return Math.round(value * minorUnitFactor(currency))
}

const dateFmt = new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' })
const dateLongFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' })
const weekdayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: '2-digit', month: '2-digit' })

/** "2026-09-01" -> "01.09.2026". Passes anything unparseable straight through. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d)
}

export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : dateLongFmt.format(d)
}

export function formatWeekday(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : weekdayFmt.format(d)
}

/** Today as YYYY-MM-DD in local time (not UTC — a receipt is dated where you stand). */
export function today(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

const listFmt = new Intl.ListFormat(LOCALE, { style: 'long', type: 'conjunction' })

/** ["Jonas", "Patrick", "Sam"] -> "Jonas, Patrick und Sam" */
export function formatList(parts: string[]): string {
  return listFmt.format(parts)
}

/** 2.5 -> "2,5" — for quantities, which are not money. */
export function formatQty(qty: number): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 3 }).format(qty)
}

/** 0.3012 -> "0,3012" — FX rates keep their precision. */
export function formatRate(rate: number): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 6 }).format(rate)
}

/** 12.5 -> "12,5 km" */
export function formatKm(km: number): string {
  return `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(km)} km`
}
