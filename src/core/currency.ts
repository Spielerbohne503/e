/**
 * Currency metadata the core needs to do integer arithmetic correctly.
 * Kept inside core/ so the calculation layer has no imports pointing outwards.
 */

/** Currencies whose smallest unit is the whole unit. */
const ZERO_DECIMAL = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF',
  'UGX', 'UYI', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
])

/** Currencies with three decimal places. */
const THREE_DECIMAL = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND'])

/** How many decimal places this currency shows, i.e. minor units per major. */
export function decimalsFor(currency: string): number {
  const code = currency.toUpperCase()
  if (ZERO_DECIMAL.has(code)) return 0
  if (THREE_DECIMAL.has(code)) return 3
  return 2
}

/** 100 for EUR, 1 for JPY, 1000 for KWD. */
export function minorUnitFactor(currency: string): number {
  return 10 ** decimalsFor(currency)
}
