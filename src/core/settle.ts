import type { Member, NettingMode, Payment, Receipt, Settlement } from './types'
import { computeBalances, computePairDebts } from './balance'

/**
 * Turns balances into actual payments.
 *
 * 'graph'  - the biggest debtor pays the biggest creditor, repeatedly.
 *            Yields at most n-1 payments, but may route money between two
 *            people who never shopped together.
 * 'direct' - nets each pair on its own. More payments, but everyone only
 *            ever pays someone they actually owe.
 */
export function settleBalances(balances: Map<string, number>, members: Member[]): Payment[] {
  const order = new Map(members.map((m) => [m.id, m.sortOrder]))
  const nach = (id: string) => order.get(id) ?? Number.MAX_SAFE_INTEGER

  const schuldner = [...balances.entries()]
    .filter(([, c]) => c < 0)
    .map(([id, c]) => ({ id, offen: -c }))
    .sort((a, b) => b.offen - a.offen || nach(a.id) - nach(b.id))

  const glaeubiger = [...balances.entries()]
    .filter(([, c]) => c > 0)
    .map(([id, c]) => ({ id, offen: c }))
    .sort((a, b) => b.offen - a.offen || nach(a.id) - nach(b.id))

  const zahlungen: Payment[] = []
  let i = 0
  let j = 0

  while (i < schuldner.length && j < glaeubiger.length) {
    const s = schuldner[i]!
    const g = glaeubiger[j]!
    const betrag = Math.min(s.offen, g.offen)

    if (betrag > 0) {
      zahlungen.push({ fromId: s.id, toId: g.id, amountCents: betrag })
      s.offen -= betrag
      g.offen -= betrag
    }

    if (s.offen === 0) i++
    if (g.offen === 0) j++
  }

  return zahlungen
}

/**
 * Nets every pair against each other and keeps whatever is left over.
 * Nobody ends up paying a person they have no shared receipt with.
 */
export function settleDirect(
  debts: Map<string, Map<string, number>>,
  members: Member[],
): Payment[] {
  const order = new Map(members.map((m) => [m.id, m.sortOrder]))
  const gesehen = new Set<string>()
  const zahlungen: Payment[] = []

  for (const [from, zeile] of debts) {
    for (const [to] of zeile) {
      const paar = [from, to].sort().join(' ')
      if (gesehen.has(paar)) continue
      gesehen.add(paar)

      const hin = debts.get(from)?.get(to) ?? 0
      const zurueck = debts.get(to)?.get(from) ?? 0
      const netto = hin - zurueck

      if (netto > 0) zahlungen.push({ fromId: from, toId: to, amountCents: netto })
      else if (netto < 0) zahlungen.push({ fromId: to, toId: from, amountCents: -netto })
    }
  }

  return zahlungen.sort(
    (a, b) =>
      b.amountCents - a.amountCents || (order.get(a.fromId) ?? 0) - (order.get(b.fromId) ?? 0),
  )
}

export interface AbrechnungOptions {
  baseCurrency: string
  nettingMode: NettingMode
}

export interface Abrechnung {
  balances: Map<string, number>
  payments: Payment[]
  /** True when nothing is owed in either direction. The one celebration. */
  quitt: boolean
}

/** The whole picture for a group: balances plus the payments that clear them. */
export function abrechnen(
  receipts: Receipt[],
  settlements: Settlement[],
  members: Member[],
  options: AbrechnungOptions,
): Abrechnung {
  const balances = computeBalances(receipts, settlements, members, {
    baseCurrency: options.baseCurrency,
  })

  const payments =
    options.nettingMode === 'direct'
      ? settleDirect(computePairDebts(receipts, settlements, members, options.baseCurrency), members)
      : settleBalances(balances, members)

  return {
    balances,
    payments,
    quitt: payments.length === 0 && [...balances.values()].every((c) => c === 0),
  }
}
