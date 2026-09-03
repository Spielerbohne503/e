import type { Receipt } from './types'
import { convertAmount } from './money'
import { decimalsFor } from './currency'

/**
 * Budget arithmetic.
 *
 * The rule: sum of every receipt in the period, in the base currency,
 * regardless of who paid. Optionally narrowed to categories. Settlements
 * never count — they move money that was already counted when the receipt
 * was recorded, so counting them again would double up.
 */

export interface BudgetDefinition {
  amountCents: number
  currency: string
  period: 'once' | 'weekly' | 'monthly'
  startsOn: string
  endsOn: string | null
  /** null means every category counts. */
  categories: string[] | null
}

export interface Zeitraum {
  von: string
  /** Inclusive. */
  bis: string
}

export interface BudgetStand {
  zeitraum: Zeitraum
  ausgegebenCents: number
  budgetCents: number
  /** Negative once the budget is exceeded. */
  restCents: number
  /** 0..1 and beyond; 1.2 means twenty percent over. */
  anteil: number
  /** Colour threshold: mint, bon or koralle. */
  stufe: 'ruhig' | 'knapp' | 'drueber'
  /** Straight-line projection of the day the budget runs out, if it will. */
  leerAm: string | null
}

const TAG_MS = 24 * 60 * 60 * 1000

const alsDatum = (iso: string): Date => new Date(`${iso}T00:00:00`)
const alsIso = (d: Date): string => d.toISOString().slice(0, 10)

/**
 * The period a budget is currently in. A weekly budget rolls on the weekday
 * it started; a monthly one on that day of the month.
 */
export function aktuellerZeitraum(budget: BudgetDefinition, heute: string): Zeitraum {
  const start = alsDatum(budget.startsOn)
  const jetzt = alsDatum(heute)

  if (budget.period === 'once') {
    return { von: budget.startsOn, bis: budget.endsOn ?? heute }
  }

  if (budget.period === 'weekly') {
    const tageSeitStart = Math.floor((jetzt.getTime() - start.getTime()) / TAG_MS)
    const wochen = Math.floor(Math.max(0, tageSeitStart) / 7)
    const von = new Date(start.getTime() + wochen * 7 * TAG_MS)
    const bis = new Date(von.getTime() + 6 * TAG_MS)
    return { von: alsIso(von), bis: alsIso(bis) }
  }

  // Monthly: same day-of-month as the start date, clamped to short months.
  const startTag = start.getDate()
  let von = new Date(jetzt.getFullYear(), jetzt.getMonth(), startTag)
  if (jetzt.getDate() < startTag) {
    von = new Date(jetzt.getFullYear(), jetzt.getMonth() - 1, startTag)
  }
  const bis = new Date(von.getFullYear(), von.getMonth() + 1, startTag)
  bis.setDate(bis.getDate() - 1)

  return { von: alsIso(von), bis: alsIso(bis) }
}

/** Whether a receipt counts towards this budget. */
function zaehltMit(receipt: Receipt, budget: BudgetDefinition, zeitraum: Zeitraum): boolean {
  if (!receipt.date) return false
  if (receipt.date < zeitraum.von || receipt.date > zeitraum.bis) return false
  if (budget.categories === null) return true
  return receipt.items.some((i) => i.category && budget.categories!.includes(i.category))
}

/**
 * How much of the budget is used. When categories are set, only the matching
 * lines count, not the whole receipt.
 */
export function budgetStand(
  receipts: Receipt[],
  budget: BudgetDefinition,
  baseCurrency: string,
  heute: string,
): BudgetStand {
  const zeitraum = aktuellerZeitraum(budget, heute)
  const baseDecimals = decimalsFor(baseCurrency)
  let ausgegeben = 0

  for (const r of receipts) {
    if (!zaehltMit(r, budget, zeitraum)) continue
    const decimals = decimalsFor(r.currency)

    if (budget.categories === null) {
      ausgegeben += convertAmount(r.totalCents, r.fxRateToBase, decimals, baseDecimals)
    } else {
      const passend = r.items
        .filter((i) => i.category && budget.categories!.includes(i.category))
        .reduce((a, i) => a + i.totalCents, 0)
      ausgegeben += convertAmount(passend, r.fxRateToBase, decimals, baseDecimals)
    }
  }

  const anteil = budget.amountCents > 0 ? ausgegeben / budget.amountCents : 0

  return {
    zeitraum,
    ausgegebenCents: ausgegeben,
    budgetCents: budget.amountCents,
    restCents: budget.amountCents - ausgegeben,
    anteil,
    stufe: anteil >= 0.9 ? 'drueber' : anteil >= 0.7 ? 'knapp' : 'ruhig',
    leerAm: hochrechnung(ausgegeben, budget.amountCents, zeitraum, heute),
  }
}

/**
 * "At this rate, empty on the 22nd." A straight line through the spend so
 * far — no forecasting beyond that, because there is no data for more.
 */
function hochrechnung(
  ausgegeben: number,
  budgetCents: number,
  zeitraum: Zeitraum,
  heute: string,
): string | null {
  if (ausgegeben <= 0 || ausgegeben >= budgetCents) return null

  const von = alsDatum(zeitraum.von)
  const jetzt = alsDatum(heute)
  const tage = Math.max(1, Math.floor((jetzt.getTime() - von.getTime()) / TAG_MS) + 1)
  const proTag = ausgegeben / tage
  if (proTag <= 0) return null

  const restTage = Math.ceil((budgetCents - ausgegeben) / proTag)
  if (!Number.isFinite(restTage) || restTage > 3650) return null

  const leer = new Date(jetzt.getTime() + restTage * TAG_MS)
  const ende = alsDatum(zeitraum.bis)

  // Only worth saying when it runs out before the period does.
  return leer <= ende ? alsIso(leer) : null
}

/** What each person spent within the period, for the detail sheet. */
export function budgetProPerson(
  receipts: Receipt[],
  budget: BudgetDefinition,
  baseCurrency: string,
  zeitraum: Zeitraum,
): Map<string, number> {
  const proPerson = new Map<string, number>()
  const baseDecimals = decimalsFor(baseCurrency)

  for (const r of receipts) {
    if (!zaehltMit(r, budget, zeitraum)) continue
    const decimals = decimalsFor(r.currency)
    const betrag =
      budget.categories === null
        ? r.totalCents
        : r.items
            .filter((i) => i.category && budget.categories!.includes(i.category))
            .reduce((a, i) => a + i.totalCents, 0)

    proPerson.set(
      r.payerId,
      (proPerson.get(r.payerId) ?? 0) + convertAmount(betrag, r.fxRateToBase, decimals, baseDecimals),
    )
  }

  return proPerson
}
