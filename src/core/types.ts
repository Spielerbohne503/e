/**
 * The calculation core speaks only in plain data. No React, no D1, no fetch.
 *
 * Every monetary value is an integer in the smallest currency unit of the
 * currency it belongs to. The only floating point number in the whole model
 * is Receipt.fxRateToBase.
 */

export type SplitMode = 'equal' | 'shares' | 'percent' | 'fixed'

/**
 * 'item' is something a person consumed.
 * The other four are collective lines: they are spread across the people
 * in proportion to what each of them took from the item lines.
 */
export type ItemKind = 'item' | 'tax' | 'tip' | 'deposit' | 'discount'

export const COLLECTIVE_KINDS: readonly ItemKind[] = ['tax', 'tip', 'deposit', 'discount']

export const isCollective = (kind: ItemKind): boolean => kind !== 'item'

export interface Member {
  id: string
  /** Decides ties when a leftover unit has to go somewhere. */
  sortOrder: number
}

export interface Split {
  memberId: string
  mode: SplitMode
  /**
   * equal   — ignored, every listed member counts once
   * shares  — share count (Jonas 2 beers, Patrick 1)
   * percent — 0..100, expected to add up to 100
   * fixed   — an amount in the receipt's currency, expected to add up to the line
   */
  value: number
}

export interface Item {
  id: string
  name: string
  qty: number
  /** In the receipt's currency. A discount line is stored negative. */
  totalCents: number
  kind: ItemKind
  category: string | null
  sortOrder: number
  /**
   * Who this line is on. Empty means nobody is assigned yet — the line then
   * counts towards the receipt total but not towards anyone's share, and the
   * UI flags it as open.
   *
   * On a collective line, splits are an explicit override: give them and the
   * line is split like an item; leave them off and it is spread in proportion.
   */
  splits: Split[]
}

export interface Receipt {
  id: string
  /** The member who fronted the money. */
  payerId: string
  /** ISO-4217, may differ from the group's base currency. */
  currency: string
  /**
   * Frozen when the receipt is saved. Multiplying an amount in `currency`
   * by this yields the amount in the group's base currency. A historical
   * settlement never moves because today's rate did.
   */
  fxRateToBase: number
  /** In `currency`. This is what was actually paid at the till. */
  totalCents: number
  date: string | null
  /** Where it was spent. Used to spot duplicates and recurring costs. */
  merchant: string | null
  items: Item[]
}

export interface Settlement {
  id: string
  fromId: string
  toId: string
  /** Always in the group's base currency. */
  amountCents: number
  settledAt: number
}

/** How the outstanding debts get turned into payments. */
export type NettingMode =
  /** Fewest payments, even between people who never shopped together. */
  | 'graph'
  /** Only nets pairs who actually settled with each other. */
  | 'direct'

export interface Payment {
  fromId: string
  toId: string
  amountCents: number
}

/** What each person owes on one receipt, in that receipt's currency. */
export type ShareMap = Map<string, number>
