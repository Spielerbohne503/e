/**
 * Integer money arithmetic. Nothing here ever produces a fractional unit,
 * and every distribution adds back up to exactly what went in.
 */

/**
 * Splits `total` across `weights` so that the parts sum to exactly `total`.
 *
 * Uses the largest remainder method: everyone gets their truncated exact
 * share, then the leftover units go to the largest fractional remainders.
 * Ties are broken by `tieBreak` ascending (the sort order of the member),
 * so the result is deterministic and never depends on map iteration order.
 *
 * Works for a negative total (a discount) and for mixed-sign weights.
 */
export function distribute(total: number, weights: number[], tieBreak: number[]): number[] {
  const n = weights.length
  if (n === 0) return []

  const sum = weights.reduce((a, b) => a + b, 0)

  // Nothing to weigh by — fall back to an even split so no money vanishes.
  if (sum === 0) {
    return distribute(
      total,
      weights.map(() => 1),
      tieBreak,
    )
  }

  const exact = weights.map((w) => (total * w) / sum)
  const parts = exact.map(Math.trunc)
  const distributed = parts.reduce((a, b) => a + b, 0)
  let rest = total - distributed

  if (rest !== 0) {
    // Fractional remainder carries the sign of the exact value, which is what
    // makes this work for negative totals as well as positive ones.
    const order = exact
      .map((e, i) => ({ i, frac: e - Math.trunc(e) }))
      .sort((a, b) => {
        // Positive leftovers go to the biggest fractions, negative to the smallest.
        const cmp = rest > 0 ? b.frac - a.frac : a.frac - b.frac
        if (cmp !== 0) return cmp
        return (tieBreak[a.i] ?? 0) - (tieBreak[b.i] ?? 0)
      })

    const step = rest > 0 ? 1 : -1
    for (let k = 0; k < order.length && rest !== 0; k++) {
      parts[order[k]!.i]! += step
      rest -= step
    }
  }

  return parts
}

/**
 * Converts an amount using a frozen rate, rounding to the target currency's
 * smallest unit. Only for a single amount — to convert a set of shares that
 * must keep summing to a known total, use `convertShares`.
 */
export function convertAmount(
  cents: number,
  rate: number,
  fromDecimals: number,
  toDecimals: number,
): number {
  const scale = 10 ** (toDecimals - fromDecimals)
  return Math.round(cents * rate * scale)
}

/**
 * Converts a set of shares into another currency while guaranteeing that
 * they still add up to the converted total. Converting each share on its own
 * would round each one independently and the sum would drift, which is what
 * would break the `sum of balances == 0` invariant.
 */
export function convertShares(
  shares: Array<{ id: string; cents: number; tieBreak: number }>,
  totalCents: number,
  rate: number,
  fromDecimals: number,
  toDecimals: number,
): Map<string, number> {
  const totalConverted = convertAmount(totalCents, rate, fromDecimals, toDecimals)
  const parts = distribute(
    totalConverted,
    shares.map((s) => s.cents),
    shares.map((s) => s.tieBreak),
  )
  const out = new Map<string, number>()
  shares.forEach((s, i) => out.set(s.id, parts[i]!))
  return out
}

/** Sums the values of a share map. */
export function sumMap(map: Map<string, number>): number {
  let total = 0
  for (const v of map.values()) total += v
  return total
}

/** Adds `delta` to `key`, treating a missing key as zero. */
export function addTo(map: Map<string, number>, key: string, delta: number): void {
  map.set(key, (map.get(key) ?? 0) + delta)
}
