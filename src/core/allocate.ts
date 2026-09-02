import type { Item, Member, Receipt, ShareMap } from './types'
import { addTo, distribute, sumMap } from './money'
import { splitItem } from './split'

/**
 * Turns a whole receipt into "who owes how much of it", in the receipt's
 * currency. This is where collective lines get spread.
 *
 * Tax, tip, deposit and discount are shared in proportion to what each
 * person took from the item lines: whoever consumed more pays more of the
 * tip and gets more of the discount. Giving such a line explicit splits
 * overrides that and treats it like any other item.
 */
export function allocateReceipt(receipt: Receipt, members: Member[]): ShareMap {
  const itemShares: ShareMap = new Map()
  const collective: Item[] = []

  for (const item of receipt.items) {
    if (item.kind === 'item') {
      for (const [memberId, cents] of splitItem(item, members)) {
        addTo(itemShares, memberId, cents)
      }
    } else {
      collective.push(item)
    }
  }

  const out: ShareMap = new Map(itemShares)

  for (const line of collective) {
    // Explicit assignment wins over proportional spreading.
    if (line.splits.length > 0) {
      for (const [memberId, cents] of splitItem(line, members)) {
        addTo(out, memberId, cents)
      }
      continue
    }

    for (const [memberId, cents] of spreadProportionally(line, itemShares, members)) {
      addTo(out, memberId, cents)
    }
  }

  return out
}

/**
 * Spreads one collective line across the people who carry item shares.
 *
 * When no item has been assigned yet there is nothing to be proportional to,
 * so the line falls back to an even split across all members — a receipt that
 * is only a tip still has to land somewhere.
 */
function spreadProportionally(line: Item, itemShares: ShareMap, members: Member[]): ShareMap {
  const out: ShareMap = new Map()
  const basis = sumMap(itemShares)

  const empfaenger =
    itemShares.size > 0 && basis !== 0
      ? [...itemShares.entries()].map(([id, cents]) => ({ id, weight: cents }))
      : members.map((m) => ({ id: m.id, weight: 1 }))

  if (empfaenger.length === 0) return out

  const order = new Map(members.map((m) => [m.id, m.sortOrder]))
  const parts = distribute(
    line.totalCents,
    empfaenger.map((e) => e.weight),
    empfaenger.map((e) => order.get(e.id) ?? Number.MAX_SAFE_INTEGER),
  )

  empfaenger.forEach((e, i) => out.set(e.id, parts[i]!))
  return out
}

/** Sum of all item lines, i.e. the receipt total before collective lines. */
export function subtotalOf(receipt: Receipt): number {
  return receipt.items
    .filter((i) => i.kind === 'item')
    .reduce((a, i) => a + i.totalCents, 0)
}

/** Sum of every line. Should equal receipt.totalCents on a consistent receipt. */
export function lineSumOf(receipt: Receipt): number {
  return receipt.items.reduce((a, i) => a + i.totalCents, 0)
}

/**
 * The gap between what the lines add up to and what the receipt says was
 * paid. Non-zero means the receipt is incomplete — the UI shows it as an
 * open remainder rather than silently swallowing it.
 */
export function remainderOf(receipt: Receipt): number {
  return receipt.totalCents - lineSumOf(receipt)
}

/** Lines nobody has been put on yet. */
export function openItems(receipt: Receipt): Item[] {
  return receipt.items.filter((i) => i.kind === 'item' && i.splits.length === 0)
}
