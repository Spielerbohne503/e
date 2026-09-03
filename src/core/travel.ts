import type { Item, Split, SplitMode } from './types'

/**
 * Fahrtkosten-Rechner.
 *
 * A trip is not a special kind of expense — it is a receipt like any other.
 * This module only does the arithmetic and hands back ordinary line items,
 * so a trip flows through splitting, balances, netting, budget and export
 * without any of them knowing it was a trip.
 *
 * The driver is the payer. The passengers are whoever the lines are split
 * across, which normally includes the driver, but does not have to: sometimes
 * the point is that the others chip in for the fuel.
 */

export interface ExtraCost {
  /** Toll, parking, ferry, fuel top-up - whatever else the trip cost. */
  label: string
  /** In the receipt's currency, always positive. */
  cents: number
}

export interface TravelInput {
  /** One-way distance when roundTrip is set, otherwise the full distance. */
  distanceKm: number
  roundTrip: boolean
  /**
   * Rate per kilometre in the smallest currency unit, e.g. 30 for 0,30 EUR/km.
   * Not a monetary amount in itself, but kept integral for the same reason.
   */
  ratePerKmCents: number
  extras: ExtraCost[]
}

export interface TravelResult {
  /** What the trip is billed for, after doubling a round trip. */
  totalDistanceKm: number
  /** distance * rate, rounded once, to the smallest currency unit. */
  distanceCents: number
  extrasCents: number
  totalCents: number
}

/**
 * The usual German per-kilometre rates, offered as a starting point.
 * They are conventions, not tax advice - the field stays editable.
 */
export const RATE_PRESETS = [
  { label: 'Auto', ratePerKmCents: 30, hint: '0,30 € pro km' },
  { label: 'Auto, lange Strecke', ratePerKmCents: 38, hint: '0,38 € pro km' },
  { label: 'Motorrad', ratePerKmCents: 20, hint: '0,20 € pro km' },
] as const

export const DEFAULT_RATE_CENTS = 30

/** Rounds once, at the end, so the cent never drifts. */
export function computeTravel(input: TravelInput): TravelResult {
  const totalDistanceKm = input.roundTrip ? input.distanceKm * 2 : input.distanceKm
  const distanceCents = Math.round(totalDistanceKm * input.ratePerKmCents)
  const extrasCents = input.extras.reduce((a, e) => a + Math.round(e.cents), 0)

  return {
    totalDistanceKm,
    distanceCents,
    extrasCents,
    totalCents: distanceCents + extrasCents,
  }
}

/** "240 km x 0,30 €" - the readable name of the distance line. */
export function travelLineName(result: TravelResult, ratePerKmCents: number, locale = 'de-DE'): string {
  const km = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(result.totalDistanceKm)
  const rate = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(ratePerKmCents / 100)
  return `Fahrt ${km} km × ${rate} €`
}

export interface TravelReceiptInput extends TravelInput {
  /** Who carries the cost, and how it is divided among them. */
  passengerIds: string[]
  splitMode?: Extract<SplitMode, 'equal' | 'shares'>
  /** Only for 'shares': how many shares each passenger carries. */
  shares?: Record<string, number>
  /** Prefix for generated ids so they stay unique within a receipt. */
  idPrefix?: string
}

/**
 * Builds the line items for a trip. The distance is one line, every extra
 * cost is its own line, and all of them carry the same split - so a toll is
 * shared exactly like the fuel.
 */
export function buildTravelItems(input: TravelReceiptInput): Item[] {
  const result = computeTravel(input)
  const prefix = input.idPrefix ?? 'fahrt'
  const mode = input.splitMode ?? 'equal'

  const splits: Split[] = input.passengerIds.map((memberId) => ({
    memberId,
    mode,
    value: mode === 'shares' ? (input.shares?.[memberId] ?? 1) : 1,
  }))

  const items: Item[] = [
    {
      id: `${prefix}_km`,
      name: travelLineName(result, input.ratePerKmCents),
      qty: result.totalDistanceKm,
      totalCents: result.distanceCents,
      kind: 'item',
      category: 'transport',
      sortOrder: 0,
      splits,
    },
  ]

  input.extras.forEach((extra, i) => {
    if (extra.cents === 0) return
    items.push({
      id: `${prefix}_extra_${i}`,
      name: extra.label.trim() || 'Zusatzkosten',
      qty: 1,
      totalCents: Math.round(extra.cents),
      kind: 'item',
      category: 'transport',
      sortOrder: i + 1,
      // Same split as the distance: a toll is shared like the fuel.
      splits,
    })
  })

  return items
}

/**
 * What one passenger pays, for the live preview while the form is being
 * filled in. Uses the same distribution as the real calculation, so the
 * preview and the saved receipt can never disagree.
 */
export function travelPerPerson(input: TravelReceiptInput): number {
  const { totalCents } = computeTravel(input)
  const n = input.passengerIds.length
  if (n === 0) return 0
  return Math.floor(totalCents / n)
}

/** Round trip is stored on the receipt so the form can be reopened as it was. */
export interface TravelSnapshot extends TravelInput {
  passengerIds: string[]
  splitMode: 'equal' | 'shares'
  shares?: Record<string, number>
  from?: string
  to?: string
}
