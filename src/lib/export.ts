import type { Snapshot } from '@/shared/api'
import { zuCoreDaten } from '@/api/hooks'
import { allocateReceipt } from '@/core/allocate'
import { formatAmount, formatDate } from './format'
import { CATEGORY_LABELS, type Category } from '@/shared/api'

/**
 * Export. CSV for a spreadsheet, print for a PDF — the browser's own
 * "save as PDF" beats shipping a PDF library for one page of a table.
 */

/** Quotes a field only when it needs it, so the file stays readable. */
function feld(wert: string | number | null | undefined): string {
  const text = String(wert ?? '')
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * One row per line item, with the share each person carries. Semicolons and
 * comma decimals, because that is what a German spreadsheet expects.
 */
export function belegeAlsCsv(snapshot: Snapshot): string {
  const { members, receipts } = zuCoreDaten(snapshot)
  const namen = new Map(snapshot.members.map((m) => [m.id, m.display_name]))
  const aktive = snapshot.members.filter((m) => !m.archived)

  const kopf = [
    'Datum',
    'Wo',
    'Position',
    'Art',
    'Kategorie',
    'Menge',
    'Betrag',
    'Währung',
    'Kurs',
    'Zahler',
    ...aktive.map((m) => `Anteil ${m.display_name}`),
  ]

  const zeilen: string[] = [kopf.map(feld).join(';')]

  for (const receipt of receipts) {
    const roh = snapshot.receipts.find((r) => r.id === receipt.id)!
    // Shares are computed per receipt, then read off per line.
    const anteile = allocateReceipt(receipt, members)
    const gesamtZugeordnet = [...anteile.values()].reduce((a, b) => a + b, 0)

    for (const item of receipt.items) {
      // Split each line's share proportionally to what the person carries
      // overall on this receipt — exact per-line shares only exist for items.
      const zeile = [
        formatDate(roh.date),
        roh.merchant ?? '',
        item.name,
        item.kind,
        item.category ? (CATEGORY_LABELS[item.category as Category] ?? item.category) : '',
        item.qty,
        formatAmount(item.totalCents, receipt.currency),
        receipt.currency,
        String(receipt.fxRateToBase).replace('.', ','),
        namen.get(receipt.payerId) ?? '',
        ...aktive.map((m) => {
          const anteil = anteile.get(m.id) ?? 0
          if (gesamtZugeordnet === 0) return ''
          const teil = Math.round((item.totalCents * anteil) / gesamtZugeordnet)
          return formatAmount(teil, receipt.currency)
        }),
      ]
      zeilen.push(zeile.map(feld).join(';'))
    }
  }

  // A BOM makes Excel read it as UTF-8 instead of mangling the umlauts.
  return `﻿${zeilen.join('\r\n')}\r\n`
}

/** Balances and the payments that would clear them, as a second CSV. */
export function saldenAlsCsv(
  snapshot: Snapshot,
  balances: Map<string, number>,
  payments: Array<{ fromId: string; toId: string; amountCents: number }>,
): string {
  const namen = new Map(snapshot.members.map((m) => [m.id, m.display_name]))
  const waehrung = snapshot.group.base_currency
  const zeilen: string[] = [['Person', `Saldo in ${waehrung}`].join(';')]

  for (const m of snapshot.members.filter((x) => !x.archived)) {
    zeilen.push([feld(m.display_name), feld(formatAmount(balances.get(m.id) ?? 0, waehrung))].join(';'))
  }

  zeilen.push('')
  zeilen.push(['Von', 'An', `Betrag in ${waehrung}`].join(';'))
  for (const p of payments) {
    zeilen.push(
      [
        feld(namen.get(p.fromId) ?? ''),
        feld(namen.get(p.toId) ?? ''),
        feld(formatAmount(p.amountCents, waehrung)),
      ].join(';'),
    )
  }

  return `﻿${zeilen.join('\r\n')}\r\n`
}

/** Hands the file to the browser. Revoked on the next tick, not left to leak. */
export function ladeHerunter(inhalt: string, dateiname: string, typ = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([inhalt], { type: typ })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = dateiname
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** A filename that sorts well and says what it is. */
export function dateiname(gruppenName: string, was: string, endung: string): string {
  const sauber = gruppenName
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
  const heute = new Date().toISOString().slice(0, 10)
  return `quitt-${sauber || 'gruppe'}-${was}-${heute}.${endung}`
}
