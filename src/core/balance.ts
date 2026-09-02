import type { Member, Receipt, Settlement } from './types'
import { addTo, convertAmount, convertShares, sumMap } from './money'
import { allocateReceipt } from './allocate'
import { decimalsFor } from './currency'

/**
 * Balances, in the group's base currency.
 *
 *   balance[p] = what p paid − what p owes
 *
 * Positive means p is owed money, negative means p owes. The sum of all
 * balances is always exactly zero; `assertBalanced` checks it.
 */

export interface BalanceOptions {
  baseCurrency: string
  /** Ignore settlements — used to show the raw picture before payments. */
  ohneAusgleich?: boolean
}

export function computeBalances(
  receipts: Receipt[],
  settlements: Settlement[],
  members: Member[],
  options: BalanceOptions,
): Map<string, number> {
  const balances = new Map<string, number>(members.map((m) => [m.id, 0]))
  const baseDecimals = decimalsFor(options.baseCurrency)
  const order = new Map(members.map((m) => [m.id, m.sortOrder]))

  for (const receipt of receipts) {
    const receiptDecimals = decimalsFor(receipt.currency)
    const shares = allocateReceipt(receipt, members)

    // The payer fronted the full receipt, converted at the frozen rate.
    const paidBase = convertAmount(
      receipt.totalCents,
      receipt.fxRateToBase,
      receiptDecimals,
      baseDecimals,
    )
    addTo(balances, receipt.payerId, paidBase)

    // Everyone's share is converted as one set, so the parts still add up to
    // exactly `paidBase` and the zero-sum invariant survives the conversion.
    const assigned = sumMap(shares)
    const zugeordnet = [...shares.entries()].map(([id, cents]) => ({
      id,
      cents,
      tieBreak: order.get(id) ?? Number.MAX_SAFE_INTEGER,
    }))

    // An incomplete receipt (unassigned lines) would otherwise hand the payer
    // a share of money nobody carries. Convert only what is actually assigned;
    // with nothing assigned at all this cancels the advance out entirely.
    const assignedBase =
      assigned === receipt.totalCents
        ? paidBase
        : convertAmount(assigned, receipt.fxRateToBase, receiptDecimals, baseDecimals)

    const sharesBase = convertShares(
      zugeordnet,
      assigned,
      receipt.fxRateToBase,
      receiptDecimals,
      baseDecimals,
    )

    for (const [memberId, cents] of sharesBase) {
      addTo(balances, memberId, -cents)
    }

    // Whatever is not assigned yet stays with the payer, so the books still
    // balance while the receipt is being worked on.
    const offen = paidBase - assignedBase
    if (offen !== 0) addTo(balances, receipt.payerId, -offen)
  }

  if (!options.ohneAusgleich) {
    for (const s of settlements) {
      // Paying settles a debt: the payer's balance rises, the receiver's falls.
      addTo(balances, s.fromId, s.amountCents)
      addTo(balances, s.toId, -s.amountCents)
    }
  }

  return balances
}

/**
 * The invariant, checked at runtime. A non-zero sum means money was created
 * or destroyed somewhere, which is a bug, not a rounding artefact.
 */
export function assertBalanced(balances: Map<string, number>): void {
  let sum = 0
  for (const v of balances.values()) sum += v
  if (sum !== 0) {
    throw new Error(`Saldensumme ist ${sum}, muss 0 sein`)
  }
}

/**
 * Pairwise debts, in base currency: how much `from` still owes `to`.
 * Only used by the 'direct' netting mode, which never routes a payment
 * through a third person.
 */
export function computePairDebts(
  receipts: Receipt[],
  settlements: Settlement[],
  members: Member[],
  baseCurrency: string,
): Map<string, Map<string, number>> {
  const debts = new Map<string, Map<string, number>>()
  const baseDecimals = decimalsFor(baseCurrency)
  const order = new Map(members.map((m) => [m.id, m.sortOrder]))

  const schulde = (from: string, to: string, cents: number) => {
    if (from === to || cents === 0) return
    let row = debts.get(from)
    if (!row) {
      row = new Map()
      debts.set(from, row)
    }
    row.set(to, (row.get(to) ?? 0) + cents)
  }

  for (const receipt of receipts) {
    const receiptDecimals = decimalsFor(receipt.currency)
    const shares = allocateReceipt(receipt, members)
    const assigned = sumMap(shares)
    if (shares.size === 0) continue

    const sharesBase = convertShares(
      [...shares.entries()].map(([id, cents]) => ({
        id,
        cents,
        tieBreak: order.get(id) ?? Number.MAX_SAFE_INTEGER,
      })),
      assigned,
      receipt.fxRateToBase,
      receiptDecimals,
      baseDecimals,
    )

    // Everyone but the payer owes the payer their share of this receipt.
    for (const [memberId, cents] of sharesBase) {
      schulde(memberId, receipt.payerId, cents)
    }
  }

  for (const s of settlements) {
    schulde(s.fromId, s.toId, -s.amountCents)
  }

  return debts
}
