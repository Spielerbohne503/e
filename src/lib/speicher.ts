/**
 * Local storage. Holds the list of groups this device knows about, keyed by
 * their tokens, plus a few per-device preferences.
 *
 * The token is the only credential in the system, so this is also the only
 * place it lives on the client. Nothing here is ever sent anywhere except as
 * the X-Quitt-Token header of a request to our own API.
 */

const SCHLUESSEL = {
  gruppen: 'quitt.gruppen',
  pins: 'quitt.pins',
  theme: 'quitt.theme',
  waehrungen: 'quitt.waehrungen',
} as const

export interface GespeicherteGruppe {
  id: string
  token: string
  /** Cached for the group list, so it renders before the first fetch lands. */
  name: string
  base_currency: string
  zuletztGeoeffnet: number
}

function lies<T>(schluessel: string, standard: T): T {
  try {
    const roh = localStorage.getItem(schluessel)
    return roh ? (JSON.parse(roh) as T) : standard
  } catch {
    // A private window or blocked site data — carry on with defaults.
    return standard
  }
}

function schreib(schluessel: string, wert: unknown): void {
  try {
    localStorage.setItem(schluessel, JSON.stringify(wert))
  } catch {
    // Nothing to do; the app keeps working, this device just forgets.
  }
}

export function gruppenListe(): GespeicherteGruppe[] {
  return lies<GespeicherteGruppe[]>(SCHLUESSEL.gruppen, []).sort(
    (a, b) => b.zuletztGeoeffnet - a.zuletztGeoeffnet,
  )
}

/**
 * Adds or refreshes a group. Leaving `token` out keeps the one already
 * stored, so refreshing a cached name can never lose the credential.
 */
export function merkeGruppe(
  gruppe: Omit<GespeicherteGruppe, 'zuletztGeoeffnet' | 'token'> & { token?: string },
): void {
  const liste = lies<GespeicherteGruppe[]>(SCHLUESSEL.gruppen, [])
  const vorhanden = liste.find((g) => g.id === gruppe.id)
  const token = gruppe.token || vorhanden?.token
  if (!token) return

  const ohne = liste.filter((g) => g.id !== gruppe.id)
  ohne.push({ ...gruppe, token, zuletztGeoeffnet: Date.now() })
  schreib(SCHLUESSEL.gruppen, ohne)
}

export function vergissGruppe(id: string): void {
  schreib(
    SCHLUESSEL.gruppen,
    lies<GespeicherteGruppe[]>(SCHLUESSEL.gruppen, []).filter((g) => g.id !== id),
  )
  const pins = lies<Record<string, string>>(SCHLUESSEL.pins, {})
  delete pins[id]
  schreib(SCHLUESSEL.pins, pins)
}

export function tokenFuer(gruppeId: string): string | null {
  return lies<GespeicherteGruppe[]>(SCHLUESSEL.gruppen, []).find((g) => g.id === gruppeId)?.token ?? null
}

export function gruppeFuerToken(token: string): GespeicherteGruppe | null {
  return lies<GespeicherteGruppe[]>(SCHLUESSEL.gruppen, []).find((g) => g.token === token) ?? null
}

/** Remembers the PIN for this device, so it is typed once and not every time. */
export function pinFuer(gruppeId: string): string | null {
  return lies<Record<string, string>>(SCHLUESSEL.pins, {})[gruppeId] ?? null
}

export function merkePin(gruppeId: string, pin: string | null): void {
  const pins = lies<Record<string, string>>(SCHLUESSEL.pins, {})
  if (pin === null) delete pins[gruppeId]
  else pins[gruppeId] = pin
  schreib(SCHLUESSEL.pins, pins)
}

export type ThemeWahl = 'system' | 'hell' | 'dunkel'

export function themeWahl(): ThemeWahl {
  return lies<ThemeWahl>(SCHLUESSEL.theme, 'system')
}

export function setzeTheme(wahl: ThemeWahl): void {
  schreib(SCHLUESSEL.theme, wahl)
  wendeThemeAn(wahl)
}

export function wendeThemeAn(wahl: ThemeWahl = themeWahl()): void {
  const wurzel = document.documentElement
  if (wahl === 'system') wurzel.removeAttribute('data-theme')
  else wurzel.setAttribute('data-theme', wahl === 'dunkel' ? 'dark' : 'light')
}

/** Recently used currencies float to the top of the currency picker. */
export function letzteWaehrungen(): string[] {
  return lies<string[]>(SCHLUESSEL.waehrungen, [])
}

export function merkeWaehrung(code: string): void {
  const liste = letzteWaehrungen().filter((c) => c !== code)
  liste.unshift(code)
  schreib(SCHLUESSEL.waehrungen, liste.slice(0, 8))
}

/**
 * Reads a sync link's token out of the URL hash and cleans up after itself,
 * so the token does not sit in the address bar or land in a screenshot.
 * Path-based routing is untouched — the hash is reserved for this.
 */
export function tokenAusHash(): string | null {
  const hash = window.location.hash
  const treffer = /^#s=([a-z0-9]{32})$/.exec(hash)
  if (!treffer) return null

  history.replaceState(null, '', window.location.pathname + window.location.search)
  return treffer[1]!
}
