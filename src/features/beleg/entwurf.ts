import type { ItemKind, SplitMode } from '@/core/types'
import type { Receipt } from '@/shared/api'
import { parseAmount } from '@/lib/format'

/**
 * The draft a receipt is edited as. Amounts are kept twice: as the raw text
 * the person typed, so the caret does not jump while typing, and as integer
 * minor units, which is what everything else in the app works with.
 */

export interface EntwurfSplit {
  memberId: string
  mode: SplitMode
  value: number
}

export interface EntwurfPosition {
  /** Local key; the server assigns real ids on save. */
  key: string
  name: string
  nameOriginal: string | null
  betragText: string
  totalCents: number
  qty: number
  kind: ItemKind
  category: string | null
  splits: EntwurfSplit[]
}

export interface BelegEntwurf {
  id?: string
  merchant: string
  date: string
  note: string
  payerId: string
  currency: string
  fxRateToBase: number
  fxDate: string
  summeText: string
  totalCents: number
  source: 'manual' | 'import' | 'travel'
  rawJson: string | null
  positionen: EntwurfPosition[]
}

let zaehler = 0
export const neuerSchluessel = (): string => `p${++zaehler}`

export function leerePosition(kind: ItemKind = 'item'): EntwurfPosition {
  return {
    key: neuerSchluessel(),
    name: '',
    nameOriginal: null,
    betragText: '',
    totalCents: 0,
    qty: 1,
    kind,
    category: null,
    splits: [],
  }
}

export function leererEntwurf(payerId: string, currency: string, heute: string): BelegEntwurf {
  return {
    merchant: '',
    date: heute,
    note: '',
    payerId,
    currency,
    fxRateToBase: 1,
    fxDate: heute,
    summeText: '',
    totalCents: 0,
    source: 'manual',
    rawJson: null,
    positionen: [leerePosition()],
  }
}

/** Loads a stored receipt back into an editable draft. */
export function alsEntwurf(receipt: Receipt): BelegEntwurf {
  return {
    id: receipt.id,
    merchant: receipt.merchant ?? '',
    date: receipt.date ?? '',
    note: receipt.note ?? '',
    payerId: receipt.payer_id,
    currency: receipt.currency,
    fxRateToBase: receipt.fx_rate_to_base,
    fxDate: receipt.fx_date,
    summeText: textFuer(receipt.total_cents, receipt.currency),
    totalCents: receipt.total_cents,
    source: receipt.source,
    rawJson: receipt.raw_json,
    positionen: receipt.items.map((i) => ({
      key: neuerSchluessel(),
      name: i.name,
      nameOriginal: i.name_original,
      betragText: textFuer(i.total_cents, receipt.currency),
      totalCents: i.total_cents,
      qty: i.qty,
      kind: i.kind,
      category: i.category,
      splits: i.splits.map((s) => ({ memberId: s.member_id, mode: s.mode, value: s.value })),
    })),
  }
}

/** Minor units back into an editable string, without a thousands separator. */
export function textFuer(cents: number, currency: string): string {
  const faktor = currency === 'JPY' || currency === 'KRW' ? 1 : 100
  if (faktor === 1) return String(cents)
  return (cents / faktor).toFixed(2).replace('.', ',')
}

/** Parses a typed amount, keeping 0 rather than failing on an empty field. */
export function betragAus(text: string, currency: string): number {
  return parseAmount(text, currency) ?? 0
}

/** The API body for saving. */
export function alsApiKoerper(entwurf: BelegEntwurf) {
  return {
    payer_id: entwurf.payerId,
    merchant: entwurf.merchant.trim() || null,
    date: entwurf.date || null,
    note: entwurf.note.trim() || null,
    currency: entwurf.currency,
    fx_rate_to_base: entwurf.fxRateToBase,
    fx_date: entwurf.fxDate,
    total_cents: entwurf.totalCents,
    source: entwurf.source,
    raw_json: entwurf.rawJson,
    items: entwurf.positionen
      .filter((p) => p.name.trim() || p.totalCents !== 0)
      .map((p, i) => ({
        name: p.name.trim() || 'Position',
        name_original: p.nameOriginal,
        qty: p.qty,
        total_cents: p.totalCents,
        kind: p.kind,
        category: p.category,
        sort_order: i,
        splits: p.splits.map((s) => ({ member_id: s.memberId, mode: s.mode, value: s.value })),
      })),
  }
}

/** Sum of every line. Compared against the receipt total to spot a gap. */
export function positionsSumme(entwurf: BelegEntwurf): number {
  return entwurf.positionen.reduce((a, p) => a + p.totalCents, 0)
}

export const KIND_LABELS: Record<ItemKind, string> = {
  item: 'Position',
  tax: 'Steuer',
  tip: 'Trinkgeld',
  deposit: 'Pfand',
  discount: 'Rabatt',
}
