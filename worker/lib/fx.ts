import type { Env } from './http'

/**
 * Exchange rates.
 *
 * Fetched once a day and kept in KV. The last good set stays as a fallback,
 * so an outage at the upstream never blocks saving a receipt — it just means
 * the rate shown is a day older, which is flagged as `stale`.
 *
 * Never fetched per page view.
 */

export interface Kurse {
  base: string
  /** The date the rates are for, YYYY-MM-DD. */
  date: string
  rates: Record<string, number>
  /** When we fetched them, so we know whether they are due for a refresh. */
  fetchedAt: number
}

const EIN_TAG = 24 * 60 * 60 * 1000

/** ECB reference rates. Free, no key, no rate limit worth worrying about. */
const FRANKFURTER = 'https://api.frankfurter.dev/v1/latest'

/** For currencies the ECB does not publish. Also free and key-less. */
const FALLBACK = 'https://open.er-api.com/v6/latest'

const kvSchluessel = (basis: string) => `fx:${basis.toUpperCase()}`

export async function holeKurse(
  env: Env,
  basis: string,
): Promise<{ kurse: Kurse; stale: boolean }> {
  // The cache is a convenience, not a requirement. Without the KV binding the
  // rates are fetched directly — slower and chattier towards the upstream,
  // but the app keeps working while Cloudflare is only half set up.
  if (!env.FX) return { kurse: await ladeVonAussen(basis), stale: false }

  const schluessel = kvSchluessel(basis)
  const gespeichert = await env.FX.get<Kurse>(schluessel, 'json')

  const frisch = gespeichert && Date.now() - gespeichert.fetchedAt < EIN_TAG
  if (frisch) return { kurse: gespeichert, stale: false }

  try {
    const kurse = await ladeVonAussen(basis)
    // Kept for a week so an outage longer than a day still has something.
    await env.FX.put(schluessel, JSON.stringify(kurse), { expirationTtl: 7 * 24 * 60 * 60 })
    return { kurse, stale: false }
  } catch {
    // The last good set beats no set at all.
    if (gespeichert) return { kurse: gespeichert, stale: true }
    throw new Error('Es sind keine Kurse verfügbar')
  }
}

async function ladeVonAussen(basis: string): Promise<Kurse> {
  const code = basis.toUpperCase()

  try {
    const antwort = await fetch(`${FRANKFURTER}?base=${code}`, {
      headers: { accept: 'application/json' },
    })
    if (antwort.ok) {
      const daten = (await antwort.json()) as { base: string; date: string; rates: Record<string, number> }
      if (daten.rates && Object.keys(daten.rates).length > 0) {
        return {
          base: daten.base,
          date: daten.date,
          // The base itself is not in the response, but 1:1 belongs in the table.
          rates: { ...daten.rates, [daten.base]: 1 },
          fetchedAt: Date.now(),
        }
      }
    }
  } catch {
    // Fall through to the second source.
  }

  const antwort = await fetch(`${FALLBACK}/${code}`, { headers: { accept: 'application/json' } })
  if (!antwort.ok) throw new Error(`Kursabruf fehlgeschlagen: ${antwort.status}`)

  const daten = (await antwort.json()) as {
    result: string
    base_code: string
    time_last_update_utc: string
    rates: Record<string, number>
  }
  if (daten.result !== 'success') throw new Error('Kursabruf ohne Ergebnis')

  return {
    base: daten.base_code,
    date: new Date(daten.time_last_update_utc).toISOString().slice(0, 10),
    rates: { ...daten.rates, [daten.base_code]: 1 },
    fetchedAt: Date.now(),
  }
}
