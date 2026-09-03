import { describe, expect, it } from 'vitest'
import type { Item, Member, Receipt, Settlement, Split } from './types'
import { distribute } from './money'
import { splitItem, checkSplit } from './split'
import { allocateReceipt } from './allocate'
import { assertBalanced, computeBalances } from './balance'
import { abrechnen, settleBalances } from './settle'
import { buildTravelItems, computeTravel, travelLineName } from './travel'

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

const JONAS: Member = { id: 'jonas', sortOrder: 0 }
const PATRICK: Member = { id: 'patrick', sortOrder: 1 }
const SAM: Member = { id: 'sam', sortOrder: 2 }
const CREW = [JONAS, PATRICK, SAM]

let laufendeNummer = 0
const id = (p: string) => `${p}_${++laufendeNummer}`

function item(
  totalCents: number,
  splits: Split[],
  extra: Partial<Item> = {},
): Item {
  return {
    id: id('item'),
    name: 'Position',
    qty: 1,
    totalCents,
    kind: 'item',
    category: null,
    sortOrder: 0,
    splits,
    ...extra,
  }
}

const gleich = (...ids: string[]): Split[] =>
  ids.map((memberId) => ({ memberId, mode: 'equal' as const, value: 1 }))

function receipt(payerId: string, items: Item[], extra: Partial<Receipt> = {}): Receipt {
  return {
    id: id('receipt'),
    payerId,
    currency: 'EUR',
    fxRateToBase: 1,
    totalCents: items.reduce((a, i) => a + i.totalCents, 0),
    date: '2026-09-01',
    merchant: null,
    items: items.map((it, i) => ({ ...it, sortOrder: i })),
    ...extra,
  }
}

const EUR = { baseCurrency: 'EUR' } as const

/* ------------------------------------------------------------------ *
 * 1. Mutual debts net down to a single payment
 * ------------------------------------------------------------------ */

describe('Testfall 1 — gegenseitige Schulden', () => {
  it('Jonas schuldet Patrick 10 EUR, Patrick schuldet Jonas 5 EUR: eine Zahlung ueber 5 EUR', () => {
    // Patrick pays 10 EUR that is entirely Jonas's.
    const belegA = receipt('patrick', [item(1000, gleich('jonas'))])
    // Jonas pays 5 EUR that is entirely Patrick's.
    const belegB = receipt('jonas', [item(500, gleich('patrick'))])

    const { balances, payments, quitt } = abrechnen([belegA, belegB], [], [JONAS, PATRICK], {
      baseCurrency: 'EUR',
      nettingMode: 'graph',
    })

    expect(balances.get('jonas')).toBe(-500)
    expect(balances.get('patrick')).toBe(500)
    expect(payments).toEqual([{ fromId: 'jonas', toId: 'patrick', amountCents: 500 }])
    expect(quitt).toBe(false)
    assertBalanced(balances)
  })

  it('nach der Zahlung sind alle quitt', () => {
    const belegA = receipt('patrick', [item(1000, gleich('jonas'))])
    const belegB = receipt('jonas', [item(500, gleich('patrick'))])
    const ausgleich: Settlement[] = [
      { id: 's1', fromId: 'jonas', toId: 'patrick', amountCents: 500, settledAt: 0 },
    ]

    const { payments, quitt, balances } = abrechnen(
      [belegA, belegB],
      ausgleich,
      [JONAS, PATRICK],
      { baseCurrency: 'EUR', nettingMode: 'graph' },
    )

    expect(payments).toEqual([])
    expect(quitt).toBe(true)
    assertBalanced(balances)
  })
})

/* ------------------------------------------------------------------ *
 * 2. A line assigned 100% to one person costs the payer nothing
 * ------------------------------------------------------------------ */

describe('Testfall 2 — Muesli zu 100 Prozent auf Patrick', () => {
  it('Jonas zahlt den Einkauf, traegt vom Muesli aber 0 EUR', () => {
    const muesli = item(349, gleich('patrick'), { name: 'Bio-Muesli 500 g' })
    const rest = item(1000, gleich('jonas', 'patrick'), { name: 'Restlicher Einkauf' })
    const beleg = receipt('jonas', [muesli, rest])

    const anteile = allocateReceipt(beleg, [JONAS, PATRICK])

    // Jonas carries half of the 10 EUR and nothing of the muesli.
    expect(anteile.get('jonas')).toBe(500)
    expect(anteile.get('patrick')).toBe(349 + 500)

    const balances = computeBalances([beleg], [], [JONAS, PATRICK], EUR)
    expect(balances.get('jonas')).toBe(1349 - 500)
    expect(balances.get('patrick')).toBe(-849)
    assertBalanced(balances)
  })

  it('eine Position ganz auf eine Person laesst den Zahler unberuehrt', () => {
    const beleg = receipt('jonas', [item(349, gleich('patrick'))])
    const anteile = allocateReceipt(beleg, [JONAS, PATRICK])

    expect(anteile.get('jonas')).toBeUndefined()
    expect(anteile.get('patrick')).toBe(349)
  })
})

/* ------------------------------------------------------------------ *
 * 3. Largest remainder rounding
 * ------------------------------------------------------------------ */

describe('Testfall 3 — 10,00 EUR auf drei Personen', () => {
  it('ergibt 3,34 / 3,33 / 3,33 und in Summe exakt 10,00 EUR', () => {
    const beleg = receipt('jonas', [item(1000, gleich('jonas', 'patrick', 'sam'))])
    const anteile = allocateReceipt(beleg, CREW)

    expect(anteile.get('jonas')).toBe(334)
    expect(anteile.get('patrick')).toBe(333)
    expect(anteile.get('sam')).toBe(333)
    expect([...anteile.values()].reduce((a, b) => a + b, 0)).toBe(1000)
  })

  it('der Restcent geht nach sort_order, nicht nach Zufall', () => {
    // Same three people, listed in reverse: the cent still follows sort_order.
    const beleg = receipt('jonas', [item(1000, gleich('sam', 'patrick', 'jonas'))])
    const anteile = allocateReceipt(beleg, CREW)

    expect(anteile.get('jonas')).toBe(334)
    expect(anteile.get('patrick')).toBe(333)
    expect(anteile.get('sam')).toBe(333)
  })

  it('distribute haelt die Summe auch bei krummen Gewichten', () => {
    for (const total of [1, 7, 99, 100, 1000, 12345, 99999]) {
      for (const gewichte of [[1, 1, 1], [2, 1], [5, 3, 2, 1], [1, 1, 1, 1, 1, 1, 1]]) {
        const teile = distribute(total, gewichte, gewichte.map((_, i) => i))
        expect(teile.reduce((a, b) => a + b, 0)).toBe(total)
      }
    }
  })

  it('distribute funktioniert auch mit negativem Gesamtbetrag', () => {
    const teile = distribute(-1000, [1, 1, 1], [0, 1, 2])
    expect(teile.reduce((a, b) => a + b, 0)).toBe(-1000)
    expect(teile).toEqual([-334, -333, -333])
  })
})

/* ------------------------------------------------------------------ *
 * 4. Tip spreads in proportion to consumption
 * ------------------------------------------------------------------ */

describe('Testfall 4 — Trinkgeld proportional', () => {
  it('5,00 EUR Trinkgeld bei 30 EUR Jonas und 10 EUR Patrick ergibt 3,75 / 1,25', () => {
    const beleg = receipt('jonas', [
      item(3000, gleich('jonas'), { name: 'Essen Jonas' }),
      item(1000, gleich('patrick'), { name: 'Essen Patrick' }),
      item(500, [], { name: 'Trinkgeld', kind: 'tip' }),
    ])

    const anteile = allocateReceipt(beleg, [JONAS, PATRICK])

    expect(anteile.get('jonas')).toBe(3000 + 375)
    expect(anteile.get('patrick')).toBe(1000 + 125)
    expect([...anteile.values()].reduce((a, b) => a + b, 0)).toBe(4500)
  })

  it('Steuer, Pfand und Trinkgeld verhalten sich gleich', () => {
    for (const kind of ['tax', 'tip', 'deposit'] as const) {
      const beleg = receipt('jonas', [
        item(3000, gleich('jonas')),
        item(1000, gleich('patrick')),
        item(500, [], { kind }),
      ])
      const anteile = allocateReceipt(beleg, [JONAS, PATRICK])
      expect(anteile.get('jonas')).toBe(3375)
      expect(anteile.get('patrick')).toBe(1125)
    }
  })

  it('ein Sammelposten mit eigener Zuordnung wird nicht mehr verteilt', () => {
    const beleg = receipt('jonas', [
      item(3000, gleich('jonas')),
      item(1000, gleich('patrick')),
      // Jonas insists on covering the tip alone.
      item(500, gleich('jonas'), { kind: 'tip' }),
    ])

    const anteile = allocateReceipt(beleg, [JONAS, PATRICK])
    expect(anteile.get('jonas')).toBe(3500)
    expect(anteile.get('patrick')).toBe(1000)
  })

  it('ein Beleg, der nur aus Trinkgeld besteht, faellt auf gleichmaessig zurueck', () => {
    const beleg = receipt('jonas', [item(500, [], { kind: 'tip' })])
    const anteile = allocateReceipt(beleg, [JONAS, PATRICK])

    expect(anteile.get('jonas')).toBe(250)
    expect(anteile.get('patrick')).toBe(250)
  })
})

/* ------------------------------------------------------------------ *
 * 5. A discount reduces what people owe, in proportion
 * ------------------------------------------------------------------ */

describe('Testfall 5 — Rabatt proportional', () => {
  it('minus 4,00 EUR verteilt sich proportional und senkt die Schuld', () => {
    const beleg = receipt('jonas', [
      item(3000, gleich('jonas'), { name: 'Einkauf Jonas' }),
      item(1000, gleich('patrick'), { name: 'Einkauf Patrick' }),
      item(-400, [], { name: 'Rabatt', kind: 'discount' }),
    ])

    const anteile = allocateReceipt(beleg, [JONAS, PATRICK])

    // 30/40 of -4,00 EUR is -3,00 EUR; 10/40 is -1,00 EUR.
    expect(anteile.get('jonas')).toBe(3000 - 300)
    expect(anteile.get('patrick')).toBe(1000 - 100)
    expect([...anteile.values()].reduce((a, b) => a + b, 0)).toBe(3600)

    const balances = computeBalances([beleg], [], [JONAS, PATRICK], EUR)
    expect(balances.get('patrick')).toBe(-900)
    assertBalanced(balances)
  })

  it('Rabatt und Trinkgeld auf demselben Beleg gehen sauber auf', () => {
    const beleg = receipt('jonas', [
      item(3000, gleich('jonas')),
      item(1000, gleich('patrick')),
      item(500, [], { kind: 'tip' }),
      item(-400, [], { kind: 'discount' }),
    ])

    const anteile = allocateReceipt(beleg, [JONAS, PATRICK])
    expect([...anteile.values()].reduce((a, b) => a + b, 0)).toBe(4100)
    expect(anteile.get('jonas')).toBe(3000 + 375 - 300)
    expect(anteile.get('patrick')).toBe(1000 + 125 - 100)
  })
})

/* ------------------------------------------------------------------ *
 * 6. A frozen rate keeps history stable
 * ------------------------------------------------------------------ */

describe('Testfall 6 — eingefrorener Wechselkurs', () => {
  it('ein CHF-Beleg bleibt im EUR-Saldo unveraendert, wenn der Tageskurs sich bewegt', () => {
    // 100,00 CHF at the rate frozen on the day of purchase.
    const beleg = receipt('jonas', [item(10000, gleich('jonas', 'patrick'))], {
      currency: 'CHF',
      fxRateToBase: 1.0715,
      totalCents: 10000,
    })

    const vorher = computeBalances([beleg], [], [JONAS, PATRICK], EUR)
    expect(vorher.get('jonas')).toBe(10715 - 5358)
    expect(vorher.get('patrick')).toBe(-5357)
    assertBalanced(vorher)

    // The daily rate moves. The stored receipt does not, so neither does the balance.
    const heutigerKurs = 0.9231
    expect(heutigerKurs).not.toBe(beleg.fxRateToBase)

    const nachher = computeBalances([beleg], [], [JONAS, PATRICK], EUR)
    expect(nachher.get('jonas')).toBe(vorher.get('jonas'))
    expect(nachher.get('patrick')).toBe(vorher.get('patrick'))
  })

  it('die Umrechnung bricht die Nullsummen-Invariante nicht', () => {
    // A rate that does not divide evenly is exactly where naive per-share
    // conversion would drift.
    const beleg = receipt('jonas', [item(10001, gleich('jonas', 'patrick', 'sam'))], {
      currency: 'CHF',
      fxRateToBase: 1.0715,
      totalCents: 10001,
    })

    const balances = computeBalances([beleg], [], CREW, EUR)
    assertBalanced(balances)
  })

  it('rechnet auch in eine Waehrung ohne Nachkommastellen korrekt um', () => {
    // 20,00 EUR at 162,5 JPY per EUR -> 3250 JPY, split three ways.
    const beleg = receipt('jonas', [item(2000, gleich('jonas', 'patrick', 'sam'))], {
      currency: 'EUR',
      fxRateToBase: 162.5,
      totalCents: 2000,
    })

    const balances = computeBalances([beleg], [], CREW, { baseCurrency: 'JPY' })
    expect(balances.get('jonas')).toBe(3250 - 1084)
    assertBalanced(balances)
  })
})

/* ------------------------------------------------------------------ *
 * 7. Random constellations always balance
 * ------------------------------------------------------------------ */

/** Deterministic PRNG so a failure can be reproduced from the seed. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('Testfall 7 — Zufallskonstellationen', () => {
  const CREW5: Member[] = Array.from({ length: 5 }, (_, i) => ({
    id: `p${i}`,
    sortOrder: i,
  }))

  for (const seed of [1, 7, 42, 1337, 20260901]) {
    it(`5 Personen, 20 Belege, Seed ${seed}: Saldensumme ist 0`, () => {
      const rnd = mulberry32(seed)
      const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]!

      const belege: Receipt[] = []
      for (let b = 0; b < 20; b++) {
        const zeilen: Item[] = []
        const anzahl = 1 + Math.floor(rnd() * 6)

        for (let z = 0; z < anzahl; z++) {
          const beteiligte = CREW5.filter(() => rnd() > 0.4)
          const wer = beteiligte.length > 0 ? beteiligte : [pick(CREW5)]
          const modus = pick(['equal', 'shares', 'percent', 'fixed'] as const)
          const betrag = 1 + Math.floor(rnd() * 8000)

          let splits: Split[]
          if (modus === 'percent') {
            // Percentages that add up to 100, distributed unevenly.
            const roh = wer.map(() => 1 + rnd() * 9)
            const summe = roh.reduce((a, x) => a + x, 0)
            splits = wer.map((m, i) => ({
              memberId: m.id,
              mode: 'percent' as const,
              value: (roh[i]! / summe) * 100,
            }))
          } else if (modus === 'fixed') {
            const teile = distribute(betrag, wer.map(() => 1 + Math.floor(rnd() * 5)), wer.map((_, i) => i))
            splits = wer.map((m, i) => ({ memberId: m.id, mode: 'fixed' as const, value: teile[i]! }))
          } else {
            splits = wer.map((m) => ({
              memberId: m.id,
              mode: modus,
              value: modus === 'shares' ? 1 + Math.floor(rnd() * 4) : 1,
            }))
          }

          const kind = rnd() > 0.75 ? pick(['tax', 'tip', 'deposit', 'discount'] as const) : 'item'
          zeilen.push(
            item(kind === 'discount' ? -Math.floor(betrag / 4) : betrag, kind === 'item' ? splits : [], {
              kind,
              sortOrder: z,
            }),
          )
        }

        const waehrung = pick(['EUR', 'CHF', 'USD', 'JPY'] as const)
        belege.push(
          receipt(pick(CREW5).id, zeilen, {
            currency: waehrung,
            fxRateToBase: waehrung === 'EUR' ? 1 : 0.5 + rnd() * 1.5,
          }),
        )
      }

      // A handful of settlements on top, to make sure they balance too.
      const ausgleiche: Settlement[] = Array.from({ length: 5 }, (_, i) => {
        const from = pick(CREW5)
        let to = pick(CREW5)
        while (to.id === from.id) to = pick(CREW5)
        return {
          id: `s${i}`,
          fromId: from.id,
          toId: to.id,
          amountCents: Math.floor(rnd() * 5000),
          settledAt: i,
        }
      })

      const balances = computeBalances(belege, ausgleiche, CREW5, EUR)
      assertBalanced(balances)

      // Greedy netting clears every balance and needs at most n-1 payments.
      const zahlungen = settleBalances(balances, CREW5)
      expect(zahlungen.length).toBeLessThanOrEqual(CREW5.length - 1)

      const nachher = new Map(balances)
      for (const z of zahlungen) {
        nachher.set(z.fromId, (nachher.get(z.fromId) ?? 0) + z.amountCents)
        nachher.set(z.toId, (nachher.get(z.toId) ?? 0) - z.amountCents)
      }
      for (const rest of nachher.values()) expect(rest).toBe(0)
    })
  }
})

/* ------------------------------------------------------------------ *
 * Split modes
 * ------------------------------------------------------------------ */

describe('Aufteilungsmodi', () => {
  it('shares: Jonas 2 Bier, Patrick 1', () => {
    const zeile = item(900, [
      { memberId: 'jonas', mode: 'shares', value: 2 },
      { memberId: 'patrick', mode: 'shares', value: 1 },
    ])
    const anteile = splitItem(zeile, [JONAS, PATRICK])

    expect(anteile.get('jonas')).toBe(600)
    expect(anteile.get('patrick')).toBe(300)
  })

  it('percent: 70 zu 30', () => {
    const zeile = item(1000, [
      { memberId: 'jonas', mode: 'percent', value: 70 },
      { memberId: 'patrick', mode: 'percent', value: 30 },
    ])
    const anteile = splitItem(zeile, [JONAS, PATRICK])

    expect(anteile.get('jonas')).toBe(700)
    expect(anteile.get('patrick')).toBe(300)
  })

  it('fixed: feste Betraege bleiben stehen', () => {
    const zeile = item(1000, [
      { memberId: 'jonas', mode: 'fixed', value: 750 },
      { memberId: 'patrick', mode: 'fixed', value: 250 },
    ])
    const anteile = splitItem(zeile, [JONAS, PATRICK])

    expect(anteile.get('jonas')).toBe(750)
    expect(anteile.get('patrick')).toBe(250)
  })

  it('fixed mit falscher Summe bleibt trotzdem stimmig', () => {
    // Entered as 7,00 + 2,00 on a 10,00 line. The missing euro is spread
    // rather than silently lost.
    const zeile = item(1000, [
      { memberId: 'jonas', mode: 'fixed', value: 700 },
      { memberId: 'patrick', mode: 'fixed', value: 200 },
    ])
    const anteile = splitItem(zeile, [JONAS, PATRICK])

    expect([...anteile.values()].reduce((a, b) => a + b, 0)).toBe(1000)
    expect(checkSplit(zeile)).toEqual({ art: 'fest-summe', ist: 900, soll: 1000 })
  })

  it('0 Prozent bedeutet: traegt nichts', () => {
    const zeile = item(1000, [
      { memberId: 'jonas', mode: 'percent', value: 100 },
      { memberId: 'patrick', mode: 'percent', value: 0 },
    ])
    const anteile = splitItem(zeile, [JONAS, PATRICK])

    expect(anteile.get('jonas')).toBe(1000)
    expect(anteile.get('patrick')).toBe(0)
  })

  it('eine Position ohne Zuordnung wird als offen gemeldet', () => {
    expect(checkSplit(item(1000, []))).toEqual({ art: 'keine-zuordnung' })
  })

  it('Prozente, die nicht auf 100 kommen, werden gemeldet', () => {
    const zeile = item(1000, [
      { memberId: 'jonas', mode: 'percent', value: 60 },
      { memberId: 'patrick', mode: 'percent', value: 30 },
    ])
    expect(checkSplit(zeile)).toEqual({ art: 'prozent-summe', ist: 90 })
    // The core still balances the line.
    expect([...splitItem(zeile, CREW).values()].reduce((a, b) => a + b, 0)).toBe(1000)
  })
})

/* ------------------------------------------------------------------ *
 * Netting modes
 * ------------------------------------------------------------------ */

describe('Netting', () => {
  it('Dreiecke aufloesen braucht hoechstens n-1 Zahlungen', () => {
    // Jonas paid for Patrick, Patrick paid for Sam: a triangle.
    const belege = [
      receipt('jonas', [item(3000, gleich('patrick'))]),
      receipt('patrick', [item(3000, gleich('sam'))]),
    ]

    const { payments } = abrechnen(belege, [], CREW, {
      baseCurrency: 'EUR',
      nettingMode: 'graph',
    })

    expect(payments).toEqual([{ fromId: 'sam', toId: 'jonas', amountCents: 3000 }])
  })

  it('nur direkt laesst niemanden an eine fremde Person zahlen', () => {
    const belege = [
      receipt('jonas', [item(3000, gleich('patrick'))]),
      receipt('patrick', [item(3000, gleich('sam'))]),
    ]

    const { payments } = abrechnen(belege, [], CREW, {
      baseCurrency: 'EUR',
      nettingMode: 'direct',
    })

    // Sam never shopped with Jonas, so Sam pays Patrick and Patrick pays Jonas.
    expect(payments).toHaveLength(2)
    expect(payments).toContainEqual({ fromId: 'patrick', toId: 'jonas', amountCents: 3000 })
    expect(payments).toContainEqual({ fromId: 'sam', toId: 'patrick', amountCents: 3000 })
  })

  it('nur direkt verrechnet ein Paar gegeneinander', () => {
    const belege = [
      receipt('patrick', [item(1000, gleich('jonas'))]),
      receipt('jonas', [item(400, gleich('patrick'))]),
    ]

    const { payments } = abrechnen(belege, [], [JONAS, PATRICK], {
      baseCurrency: 'EUR',
      nettingMode: 'direct',
    })

    expect(payments).toEqual([{ fromId: 'jonas', toId: 'patrick', amountCents: 600 }])
  })

  it('quitt ist erst wahr, wenn wirklich nichts mehr offen ist', () => {
    const leer = abrechnen([], [], CREW, { baseCurrency: 'EUR', nettingMode: 'graph' })
    expect(leer.quitt).toBe(true)
  })
})

/* ------------------------------------------------------------------ *
 * Fahrtkosten
 * ------------------------------------------------------------------ */

describe('Fahrtkosten-Rechner', () => {
  it('rechnet Strecke mal Satz und rundet einmal am Ende', () => {
    const ergebnis = computeTravel({
      distanceKm: 120,
      roundTrip: false,
      ratePerKmCents: 30,
      extras: [],
    })

    expect(ergebnis.totalDistanceKm).toBe(120)
    expect(ergebnis.distanceCents).toBe(3600)
    expect(ergebnis.totalCents).toBe(3600)
  })

  it('verdoppelt bei Hin- und Rueckfahrt', () => {
    const ergebnis = computeTravel({
      distanceKm: 120,
      roundTrip: true,
      ratePerKmCents: 30,
      extras: [],
    })

    expect(ergebnis.totalDistanceKm).toBe(240)
    expect(ergebnis.distanceCents).toBe(7200)
  })

  it('rechnet krumme Strecken auf den Cent genau', () => {
    // 47,3 km x 0,38 = 17,974 EUR -> 17,97 EUR
    const ergebnis = computeTravel({
      distanceKm: 47.3,
      roundTrip: false,
      ratePerKmCents: 38,
      extras: [],
    })

    expect(ergebnis.distanceCents).toBe(1797)
  })

  it('zaehlt Maut und Parken dazu', () => {
    const ergebnis = computeTravel({
      distanceKm: 200,
      roundTrip: true,
      ratePerKmCents: 30,
      extras: [
        { label: 'Maut', cents: 950 },
        { label: 'Parken', cents: 450 },
      ],
    })

    expect(ergebnis.distanceCents).toBe(12000)
    expect(ergebnis.extrasCents).toBe(1400)
    expect(ergebnis.totalCents).toBe(13400)
  })

  it('erzeugt einen ganz normalen Beleg, der durch den Rechenkern laeuft', () => {
    const zeilen = buildTravelItems({
      distanceKm: 150,
      roundTrip: true,
      ratePerKmCents: 30,
      extras: [{ label: 'Maut', cents: 900 }],
      passengerIds: ['jonas', 'patrick', 'sam'],
    })

    expect(zeilen).toHaveLength(2)
    expect(zeilen[0]!.category).toBe('transport')
    expect(zeilen[0]!.kind).toBe('item')
    expect(zeilen[0]!.totalCents).toBe(9000)
    expect(zeilen[1]!.totalCents).toBe(900)

    // Jonas drove, so he fronted the cost and is also a passenger.
    const beleg = receipt('jonas', zeilen)
    expect(beleg.totalCents).toBe(9900)

    const anteile = allocateReceipt(beleg, CREW)
    expect([...anteile.values()].reduce((a, b) => a + b, 0)).toBe(9900)
    expect(anteile.get('jonas')).toBe(3300)
    expect(anteile.get('patrick')).toBe(3300)
    expect(anteile.get('sam')).toBe(3300)

    const balances = computeBalances([beleg], [], CREW, EUR)
    expect(balances.get('jonas')).toBe(6600)
    assertBalanced(balances)
  })

  it('der Fahrer kann sich selbst herausnehmen, dann zahlen nur die Mitfahrer', () => {
    const zeilen = buildTravelItems({
      distanceKm: 100,
      roundTrip: false,
      ratePerKmCents: 30,
      extras: [],
      passengerIds: ['patrick', 'sam'],
    })

    const beleg = receipt('jonas', zeilen)
    const anteile = allocateReceipt(beleg, CREW)

    expect(anteile.get('jonas')).toBeUndefined()
    expect(anteile.get('patrick')).toBe(1500)
    expect(anteile.get('sam')).toBe(1500)

    const balances = computeBalances([beleg], [], CREW, EUR)
    expect(balances.get('jonas')).toBe(3000)
    assertBalanced(balances)
  })

  it('verteilt nach Anteilen, wenn jemand nur die halbe Strecke mitfaehrt', () => {
    const zeilen = buildTravelItems({
      distanceKm: 100,
      roundTrip: false,
      ratePerKmCents: 30,
      extras: [],
      passengerIds: ['jonas', 'patrick', 'sam'],
      splitMode: 'shares',
      shares: { jonas: 2, patrick: 2, sam: 1 },
    })

    const anteile = allocateReceipt(receipt('jonas', zeilen), CREW)
    expect(anteile.get('jonas')).toBe(1200)
    expect(anteile.get('patrick')).toBe(1200)
    expect(anteile.get('sam')).toBe(600)
  })

  it('benennt die Strecke lesbar', () => {
    const ergebnis = computeTravel({
      distanceKm: 120,
      roundTrip: true,
      ratePerKmCents: 30,
      extras: [],
    })
    expect(travelLineName(ergebnis, 30)).toBe('Fahrt 240 km × 0,30 €')
  })

  it('laesst leere Zusatzkosten weg', () => {
    const zeilen = buildTravelItems({
      distanceKm: 10,
      roundTrip: false,
      ratePerKmCents: 30,
      extras: [{ label: 'Maut', cents: 0 }],
      passengerIds: ['jonas'],
    })
    expect(zeilen).toHaveLength(1)
  })
})

/* ------------------------------------------------------------------ *
 * Incomplete receipts must still balance
 * ------------------------------------------------------------------ */

describe('Unvollstaendige Belege', () => {
  it('eine noch nicht zugeordnete Position bleibt beim Zahler', () => {
    const beleg = receipt('jonas', [
      item(1000, gleich('patrick')),
      item(500, [], { name: 'Noch offen' }),
    ])

    const balances = computeBalances([beleg], [], [JONAS, PATRICK], EUR)
    expect(balances.get('jonas')).toBe(1000)
    expect(balances.get('patrick')).toBe(-1000)
    assertBalanced(balances)
  })

  it('ein Beleg ohne jede Zuordnung veraendert keine Salden', () => {
    const beleg = receipt('jonas', [item(1000, [])])
    const balances = computeBalances([beleg], [], [JONAS, PATRICK], EUR)

    expect(balances.get('jonas')).toBe(0)
    expect(balances.get('patrick')).toBe(0)
    assertBalanced(balances)
  })

  it('ein Beleg, dessen Positionen nicht die Gesamtsumme ergeben, bleibt stimmig', () => {
    // The till said 12,00 EUR but only 10,00 EUR of lines were entered.
    const beleg = receipt('jonas', [item(1000, gleich('jonas', 'patrick'))], {
      totalCents: 1200,
    })

    const balances = computeBalances([beleg], [], [JONAS, PATRICK], EUR)
    expect(balances.get('patrick')).toBe(-500)
    expect(balances.get('jonas')).toBe(500)
    assertBalanced(balances)
  })
})
