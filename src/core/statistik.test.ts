import { describe, expect, it } from 'vitest'
import type { Item, Member, Receipt, Split } from './types'
import { auswerten, baueVorschlaege, findeDuplikate, findeWiederkehrende, vorschlagFuer } from './statistik'
import { aktuellerZeitraum, budgetStand, type BudgetDefinition } from './budget'

const JONAS: Member = { id: 'jonas', sortOrder: 0 }
const PATRICK: Member = { id: 'patrick', sortOrder: 1 }
const CREW = [JONAS, PATRICK]

let n = 0
const gleich = (...ids: string[]): Split[] =>
  ids.map((memberId) => ({ memberId, mode: 'equal' as const, value: 1 }))

function item(name: string, totalCents: number, splits: Split[], category: string | null = null): Item {
  return { id: `i${++n}`, name, qty: 1, totalCents, kind: 'item', category, sortOrder: 0, splits }
}

function receipt(
  payerId: string,
  items: Item[],
  extra: Partial<Receipt> = {},
): Receipt {
  return {
    id: `r${++n}`,
    payerId,
    currency: 'EUR',
    fxRateToBase: 1,
    totalCents: items.reduce((a, i) => a + i.totalCents, 0),
    date: '2026-09-01',
    merchant: null,
    items,
    ...extra,
  }
}

describe('Auswertung', () => {
  it('trennt was jemand verbraucht hat von dem, was er ausgelegt hat', () => {
    const beleg = receipt('jonas', [
      item('Müsli', 349, gleich('patrick'), 'lebensmittel'),
      item('Rest', 1000, gleich('jonas', 'patrick'), 'lebensmittel'),
    ])

    const a = auswerten([beleg], CREW, 'EUR')

    expect(a.gezahltProPerson.get('jonas')).toBe(1349)
    expect(a.gezahltProPerson.get('patrick')).toBeUndefined()
    expect(a.proPerson.get('jonas')).toBe(500)
    expect(a.proPerson.get('patrick')).toBe(849)
    expect(a.gesamtCents).toBe(1349)
    expect(a.belegAnzahl).toBe(1)
  })

  it('summiert nach Kategorie und Monat', () => {
    const belege = [
      receipt('jonas', [item('Brot', 300, gleich('jonas'), 'lebensmittel')], { date: '2026-08-15' }),
      receipt('jonas', [item('Bier', 700, gleich('jonas'), 'getraenke')], { date: '2026-09-02' }),
    ]

    const a = auswerten(belege, CREW, 'EUR')
    expect(a.proKategorie.get('lebensmittel')).toBe(300)
    expect(a.proKategorie.get('getraenke')).toBe(700)
    expect(a.proMonat.get('2026-08')).toBe(300)
    expect(a.proMonat.get('2026-09')).toBe(700)
  })

  it('rechnet Fremdwaehrungen mit dem eingefrorenen Kurs um', () => {
    const beleg = receipt('jonas', [item('Fondue', 10000, gleich('jonas'))], {
      currency: 'CHF',
      fxRateToBase: 1.0715,
      totalCents: 10000,
    })

    expect(auswerten([beleg], CREW, 'EUR').gesamtCents).toBe(10715)
  })

  it('beachtet den Zeitfilter', () => {
    const belege = [
      receipt('jonas', [item('Alt', 100, gleich('jonas'))], { date: '2026-07-01' }),
      receipt('jonas', [item('Neu', 200, gleich('jonas'))], { date: '2026-09-01' }),
    ]

    const a = auswerten(belege, CREW, 'EUR', { von: '2026-08-01' })
    expect(a.gesamtCents).toBe(200)
    expect(a.belegAnzahl).toBe(1)
  })
})

describe('Duplikat-Erkennung', () => {
  it('findet denselben Beleg zweimal erfasst', () => {
    const a = receipt('jonas', [item('REWE', 4217, gleich('jonas'))], { date: '2026-09-01' })
    const b = receipt('jonas', [item('REWE', 4217, gleich('jonas'))], { date: '2026-09-02' })

    const treffer = findeDuplikate([a, b])
    expect(treffer).toHaveLength(1)
    expect(treffer[0]!.grund).toContain('gleiche erste Position')
  })

  it('meldet nichts bei unterschiedlichen Zahlern', () => {
    const a = receipt('jonas', [item('REWE', 4217, gleich('jonas'))], { date: '2026-09-01' })
    const b = receipt('patrick', [item('REWE', 4217, gleich('jonas'))], { date: '2026-09-01' })
    expect(findeDuplikate([a, b])).toHaveLength(0)
  })

  it('meldet nichts, wenn die Belege weit auseinanderliegen', () => {
    const a = receipt('jonas', [item('Miete', 80000, gleich('jonas'))], { date: '2026-08-01' })
    const b = receipt('jonas', [item('Miete', 80000, gleich('jonas'))], { date: '2026-09-01' })
    expect(findeDuplikate([a, b])).toHaveLength(0)
  })
})

describe('Lernende Zuordnung', () => {
  it('schlaegt vor, was zweimal gleich zugeordnet wurde', () => {
    const belege = [
      receipt('jonas', [item('BIO MUESLI 500G', 349, gleich('patrick'))]),
      receipt('jonas', [item('Bio-Müsli 500 g', 349, gleich('patrick'))]),
    ]

    const vorschlaege = baueVorschlaege(belege)
    const treffer = vorschlagFuer(vorschlaege, 'BIO MUESLI 500G')

    expect(treffer).not.toBeNull()
    expect(treffer!.memberIds).toEqual(['patrick'])
    expect(treffer!.belege).toBe(2)
  })

  it('schlaegt nach einem einzigen Mal noch nichts vor', () => {
    const belege = [receipt('jonas', [item('Hafermilch', 238, gleich('jonas'))])]
    expect(vorschlagFuer(baueVorschlaege(belege), 'Hafermilch')).toBeNull()
  })

  it('ignoriert Mengenangaben beim Vergleich', () => {
    const belege = [
      receipt('jonas', [item('Milch 1L', 129, gleich('jonas'))]),
      receipt('jonas', [item('MILCH 1 L', 129, gleich('jonas'))]),
    ]
    expect(vorschlagFuer(baueVorschlaege(belege), 'Milch')).not.toBeNull()
  })
})

describe('Wiederkehrende Kosten', () => {
  it('erkennt einen monatlichen Rhythmus', () => {
    const belege = ['2026-07-01', '2026-08-01', '2026-09-01'].map((date) =>
      receipt('jonas', [item('Miete', 80000, gleich('jonas'))], { date, merchant: 'Vermieter' }),
    )

    const treffer = findeWiederkehrende(belege)
    expect(treffer).toHaveLength(1)
    expect(treffer[0]!.name).toBe('Vermieter')
    expect(treffer[0]!.abstandTage).toBeGreaterThanOrEqual(30)
    expect(treffer[0]!.betragCents).toBe(80000)
  })

  it('braucht mindestens drei Sichtungen', () => {
    const belege = ['2026-08-01', '2026-09-01'].map((date) =>
      receipt('jonas', [item('Miete', 80000, gleich('jonas'))], { date, merchant: 'Vermieter' }),
    )
    expect(findeWiederkehrende(belege)).toHaveLength(0)
  })
})

describe('Budget', () => {
  const definition: BudgetDefinition = {
    amountCents: 60000,
    currency: 'EUR',
    period: 'monthly',
    startsOn: '2026-09-01',
    endsOn: null,
    categories: null,
  }

  it('zaehlt jede Ausgabe im Zeitraum, egal wer gezahlt hat', () => {
    const belege = [
      receipt('jonas', [item('Einkauf', 20000, gleich('jonas'))], { date: '2026-09-03' }),
      receipt('patrick', [item('Einkauf', 21280, gleich('patrick'))], { date: '2026-09-10' }),
    ]

    const stand = budgetStand(belege, definition, 'EUR', '2026-09-15')
    expect(stand.ausgegebenCents).toBe(41280)
    expect(stand.restCents).toBe(18720)
    expect(stand.stufe).toBe('ruhig')
  })

  it('wechselt die Stufe bei 70 und 90 Prozent', () => {
    const bei = (cents: number) =>
      budgetStand(
        [receipt('jonas', [item('X', cents, gleich('jonas'))], { date: '2026-09-05' })],
        definition,
        'EUR',
        '2026-09-15',
      ).stufe

    expect(bei(41999)).toBe('ruhig')
    expect(bei(42000)).toBe('knapp')
    expect(bei(53999)).toBe('knapp')
    expect(bei(54000)).toBe('drueber')
  })

  it('zeigt eine Ueberschreitung als negativen Rest', () => {
    const belege = [receipt('jonas', [item('X', 64210, gleich('jonas'))], { date: '2026-09-05' })]
    const stand = budgetStand(belege, definition, 'EUR', '2026-09-15')
    expect(stand.restCents).toBe(-4210)
  })

  it('laesst Belege ausserhalb des Zeitraums weg', () => {
    const belege = [receipt('jonas', [item('X', 10000, gleich('jonas'))], { date: '2026-08-20' })]
    expect(budgetStand(belege, definition, 'EUR', '2026-09-15').ausgegebenCents).toBe(0)
  })

  it('zaehlt bei gesetzten Kategorien nur die passenden Positionen', () => {
    const nurGetraenke: BudgetDefinition = { ...definition, categories: ['getraenke'] }
    const beleg = receipt(
      'jonas',
      [
        item('Brot', 300, gleich('jonas'), 'lebensmittel'),
        item('Bier', 700, gleich('jonas'), 'getraenke'),
      ],
      { date: '2026-09-05' },
    )

    expect(budgetStand([beleg], nurGetraenke, 'EUR', '2026-09-15').ausgegebenCents).toBe(700)
  })

  it('rollt den Monatszeitraum auf den Starttag', () => {
    const abDem15: BudgetDefinition = { ...definition, startsOn: '2026-06-15' }
    expect(aktuellerZeitraum(abDem15, '2026-09-20')).toEqual({ von: '2026-09-15', bis: '2026-10-14' })
    expect(aktuellerZeitraum(abDem15, '2026-09-10')).toEqual({ von: '2026-08-15', bis: '2026-09-14' })
  })

  it('rollt den Wochenzeitraum auf den Starttag', () => {
    const woechentlich: BudgetDefinition = { ...definition, period: 'weekly', startsOn: '2026-09-07' }
    expect(aktuellerZeitraum(woechentlich, '2026-09-09')).toEqual({ von: '2026-09-07', bis: '2026-09-13' })
    expect(aktuellerZeitraum(woechentlich, '2026-09-15')).toEqual({ von: '2026-09-14', bis: '2026-09-20' })
  })

  it('rechnet hoch, wann das Budget leer ist', () => {
    // 200 EUR in the first five days of a 600 EUR month: 40 EUR a day.
    const belege = [receipt('jonas', [item('X', 20000, gleich('jonas'))], { date: '2026-09-01' })]
    const stand = budgetStand(belege, definition, 'EUR', '2026-09-05')
    expect(stand.leerAm).not.toBeNull()
  })
})
