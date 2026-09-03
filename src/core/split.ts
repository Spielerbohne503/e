import type { Item, Member, ShareMap, Split, SplitMode } from './types'
import { distribute } from './money'

/**
 * Turns one line item into "who owes how much of it", in the receipt's
 * currency. The parts always add up to exactly item.totalCents.
 */

/** All splits on a line share one mode; the first one decides. */
function modeOf(splits: Split[]): SplitMode {
  return splits[0]?.mode ?? 'equal'
}

function tieBreaksFor(splits: Split[], members: Member[]): number[] {
  const order = new Map(members.map((m) => [m.id, m.sortOrder]))
  return splits.map((s) => order.get(s.memberId) ?? Number.MAX_SAFE_INTEGER)
}

/**
 * Weights per split mode. `fixed` is handled separately because its values
 * are amounts, not weights.
 */
function weightsFor(splits: Split[], mode: SplitMode): number[] {
  switch (mode) {
    case 'equal':
      return splits.map(() => 1)
    case 'shares':
    case 'percent':
      // Both are proportional; percent simply happens to add up to 100.
      // A non-positive value would silently drop the person, so clamp it.
      return splits.map((s) => Math.max(0, s.value))
    case 'fixed':
      return splits.map((s) => Math.abs(s.value))
  }
}

/**
 * Splits a single line. An unassigned line returns an empty map: it still
 * counts towards the receipt total, but nobody carries it yet.
 */
export function splitItem(item: Item, members: Member[]): ShareMap {
  const out: ShareMap = new Map()
  if (item.splits.length === 0) return out

  const mode = modeOf(item.splits)
  const tieBreaks = tieBreaksFor(item.splits, members)

  if (mode === 'fixed') {
    // Fixed amounts are taken as given, but the line still has to add up.
    // If the numbers were entered inconsistently we spread the difference
    // proportionally rather than let the invariant break.
    const fixed = item.splits.map((s) => Math.round(s.value))
    const sum = fixed.reduce((a, b) => a + b, 0)
    const diff = item.totalCents - sum

    const korrektur =
      diff === 0
        ? fixed.map(() => 0)
        : distribute(
            diff,
            fixed.map((v) => Math.abs(v)),
            tieBreaks,
          )
    const parts = fixed.map((f, i) => f + korrektur[i]!)

    item.splits.forEach((s, i) => out.set(s.memberId, parts[i]!))
    return out
  }

  const parts = distribute(item.totalCents, weightsFor(item.splits, mode), tieBreaks)
  item.splits.forEach((s, i) => out.set(s.memberId, parts[i]!))
  return out
}

export type SplitProblem =
  | { art: 'prozent-summe'; ist: number }
  | { art: 'fest-summe'; ist: number; soll: number }
  | { art: 'keine-zuordnung' }
  | { art: 'anteile-null' }

/**
 * Checks a line for the problems a person can actually fix. Used by the UI
 * to flag a line; the core itself stays tolerant and always balances.
 */
export function checkSplit(item: Item): SplitProblem | null {
  if (item.splits.length === 0) return { art: 'keine-zuordnung' }

  const mode = modeOf(item.splits)
  const sum = item.splits.reduce((a, s) => a + s.value, 0)

  if (mode === 'percent' && Math.abs(sum - 100) > 0.001) {
    return { art: 'prozent-summe', ist: sum }
  }
  if (mode === 'fixed' && Math.round(sum) !== item.totalCents) {
    return { art: 'fest-summe', ist: Math.round(sum), soll: item.totalCents }
  }
  if (mode === 'shares' && sum <= 0) {
    return { art: 'anteile-null' }
  }
  return null
}
