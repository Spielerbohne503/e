import type { z, ZodError, ZodTypeAny } from 'zod'

/**
 * Cloudflare bindings. Declared in wrangler.toml.
 *
 * DB and FX are optional at the type level on purpose: the Worker deploys
 * before `npm run setup:cloudflare` has created them, and it should say so
 * rather than crash. Without DB the API answers 503 with instructions;
 * without FX the rates are simply fetched uncached.
 */
export interface Env {
  DB?: D1Database
  FX?: KVNamespace
  /** The built single-page app. Serves everything outside /api. */
  ASSETS: Fetcher
}

/** Narrowed Env for everything that genuinely needs the database. */
export interface EnvMitDb extends Env {
  DB: D1Database
}

/**
 * The API is useless without D1, so say that plainly instead of failing with
 * an internal error. 503 is right: the service is not set up yet, and it will
 * work once it is.
 */
export function datenbankFehlt(): Response {
  return json(
    {
      fehler: 'Die Datenbank ist noch nicht eingerichtet',
      hinweis: 'npm run setup:cloudflare, dann npm run db:remote',
      einrichtung: true,
    },
    503,
  )
}

/** Every route runs behind the DB check in worker/index.ts, so it has one. */
export type Handler = (ctx: {
  request: Request
  env: EnvMitDb
  params: Record<string, string>
  url: URL
}) => Promise<Response>

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  // The API is same-origin only; nothing here is meant to be embedded.
  'cache-control': 'no-store',
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS })
}

/** Errors are plain German sentences, no stack traces, no exclamation marks. */
export function fehler(nachricht: string, status = 400, feld?: string): Response {
  return json(feld ? { fehler: nachricht, feld } : { fehler: nachricht }, status)
}

export const nichtGefunden = () => fehler('Nicht gefunden', 404)
export const keinZugriff = () => fehler('Kein Zugriff', 403)

/**
 * Parses and validates a JSON body. Turns a zod failure into a message a
 * person can act on, naming the field that is wrong.
 */
export async function leseKoerper<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<z.output<S> | Response> {
  let roh: unknown
  try {
    roh = await request.json()
  } catch {
    return fehler('Der Anfragekörper ist kein gültiges JSON')
  }

  const ergebnis = schema.safeParse(roh)
  if (!ergebnis.success) {
    const { pfad, nachricht } = ersterFehler(ergebnis.error)
    return fehler(nachricht, 422, pfad)
  }
  return ergebnis.data
}

function ersterFehler(error: ZodError): { pfad: string; nachricht: string } {
  const issue = error.issues[0]
  if (!issue) return { pfad: '', nachricht: 'Die Daten sind ungültig' }
  const pfad = issue.path.join('.')
  return { pfad, nachricht: pfad ? `${pfad}: ${issue.message}` : issue.message }
}

/**
 * A tiny router. Patterns look like 'groups/:id/members/:mid'; a match binds
 * the named segments into params. Beats twelve files of near-identical
 * boilerplate, and keeps the auth check in exactly one place.
 */
export interface Route {
  method: string
  pattern: string
  handler: Handler
  /** Set for the two endpoints that run before a token exists. */
  oeffentlich?: boolean
}

export function findeRoute(
  routes: Route[],
  method: string,
  pfad: string,
): { route: Route; params: Record<string, string> } | null {
  const teile = pfad.split('/').filter(Boolean)

  for (const route of routes) {
    if (route.method !== method) continue
    const muster = route.pattern.split('/').filter(Boolean)
    if (muster.length !== teile.length) continue

    const params: Record<string, string> = {}
    let passt = true

    for (let i = 0; i < muster.length; i++) {
      const m = muster[i]!
      const t = teile[i]!
      if (m.startsWith(':')) params[m.slice(1)] = decodeURIComponent(t)
      else if (m !== t) {
        passt = false
        break
      }
    }

    if (passt) return { route, params }
  }

  return null
}

/** SHA-256 hex digest, used for the optional PIN. */
export async function hashe(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Constant-time comparison so a PIN cannot be guessed by timing. */
export function gleichSicher(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function jetzt(): number {
  return Date.now()
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function neueId(prefix: string): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length]
  return `${prefix}_${out}`
}

/** 32 characters from a cryptographic source. The only secret in the system. */
export function neuerSpaceToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length]
  return out
}
