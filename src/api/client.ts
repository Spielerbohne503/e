import type {
  Budget,
  Group,
  Member,
  Receipt,
  Settlement,
  Snapshot,
} from '@/shared/api'
import { pinFuer, tokenFuer } from '@/lib/speicher'
import { lokal } from './lokal'

/**
 * The API client. Every request but "create a group" carries the group's
 * token; without it the server answers 403 and the app shows read-only.
 */

export class ApiFehler extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly feld?: string,
    /** Set by the Worker when D1 is not configured yet. */
    readonly einrichtung?: boolean,
  ) {
    super(message)
    this.name = 'ApiFehler'
  }

  /** 401 means a PIN is set and missing or wrong. */
  get brauchtPin(): boolean {
    return this.status === 401
  }

  /** The Worker is live but has no database binding yet. */
  get brauchtEinrichtung(): boolean {
    return this.status === 503 && this.einrichtung === true
  }

  get keinZugriff(): boolean {
    return this.status === 403
  }
}

async function anfrage<T>(
  pfad: string,
  init: RequestInit & { gruppeId?: string } = {},
): Promise<T> {
  const { gruppeId, ...rest } = init
  const headers = new Headers(rest.headers)

  if (gruppeId) {
    const token = tokenFuer(gruppeId)
    if (token) headers.set('X-Quitt-Token', token)
    const pin = pinFuer(gruppeId)
    if (pin) headers.set('X-Quitt-Pin', pin)
  }
  if (rest.body) headers.set('Content-Type', 'application/json')

  let antwort: Response
  try {
    antwort = await fetch(`/api/${pfad}`, { ...rest, headers })
  } catch {
    // Offline or the request never left. No queue, no retry — the UI drops
    // into read-only and says so.
    throw new ApiFehler('Keine Verbindung', 0)
  }

  if (antwort.status === 204) return undefined as T

  const text = await antwort.text()
  const daten = text ? (JSON.parse(text) as unknown) : null

  if (!antwort.ok) {
    const body = daten as { fehler?: string; feld?: string; einrichtung?: boolean } | null
    throw new ApiFehler(
      body?.fehler ?? 'Da ist etwas schiefgegangen',
      antwort.status,
      body?.feld,
      body?.einrichtung,
    )
  }

  return daten as T
}

/* ------------------------------------------------------------------ *
 * Backend choice
 * ------------------------------------------------------------------ */

/**
 * Whether the Worker has a database. Asked once per page load; until the
 * answer is in, the app assumes the server is there, which is the normal case.
 *
 * Without D1 every call is served from local storage instead, so the app is
 * fully usable on one device rather than showing a setup notice and nothing.
 */
let serverBereit: boolean | null = null

export async function pruefeBackend(): Promise<boolean> {
  if (serverBereit !== null) return serverBereit
  try {
    const antwort = await fetch('/api/status')
    if (!antwort.ok) {
      serverBereit = false
      return false
    }
    const body = (await antwort.json()) as { bereit?: boolean }
    serverBereit = body.bereit !== false
  } catch {
    // Offline: keep the server path, so the UI shows its read-only notice
    // rather than silently forking into a second, local data set.
    serverBereit = true
  }
  return serverBereit
}

/** True once the check has run and found no database. */
export function laeuftLokal(): boolean {
  return serverBereit === false
}

/* ------------------------------------------------------------------ *
 * Groups
 * ------------------------------------------------------------------ */

export interface NeueGruppeAntwort extends Snapshot {
  /** Returned exactly once, when the group is created. */
  space_token: string
}

/**
 * Runs against the Worker when a database is configured, against local
 * storage when it is not. Both paths return the same shapes, so nothing
 * above this file needs to know which one is active.
 */
export const api = {
  async gruppeAnlegen(body: {
    name: string
    base_currency: string
    members?: Array<{ display_name: string; color: string }>
  }): Promise<NeueGruppeAntwort> {
    if (!(await pruefeBackend())) return lokal.gruppeAnlegen(body)
    return anfrage<NeueGruppeAntwort>('groups', { method: 'POST', body: JSON.stringify(body) })
  },

  async snapshot(gruppeId: string): Promise<Snapshot> {
    if (!(await pruefeBackend())) return lokal.snapshot(gruppeId)
    return anfrage<Snapshot>(`groups/${gruppeId}`, { gruppeId })
  },

  /** One integer, for the fifteen-second poll. */
  async revision(gruppeId: string): Promise<{ revision: number }> {
    if (!(await pruefeBackend())) return lokal.revision(gruppeId)
    return anfrage<{ revision: number }>(`groups/${gruppeId}/revision`, { gruppeId })
  },

  async gruppeAendern(
    gruppeId: string,
    body: {
      name?: string
      base_currency?: string
      netting_mode?: 'graph' | 'direct'
      show_zetti?: boolean
      pin?: string | null
    },
  ): Promise<Group> {
    if (!(await pruefeBackend())) return lokal.gruppeAendern(gruppeId, body)
    return anfrage<Group>(`groups/${gruppeId}`, { method: 'PATCH', body: JSON.stringify(body), gruppeId })
  },

  async gruppeLoeschen(gruppeId: string): Promise<{ geloescht: true }> {
    if (!(await pruefeBackend())) return lokal.gruppeLoeschen(gruppeId)
    return anfrage<{ geloescht: true }>(`groups/${gruppeId}`, { method: 'DELETE', gruppeId })
  },

  async tokenErneuern(gruppeId: string): Promise<{ space_token: string }> {
    if (!(await pruefeBackend())) return lokal.tokenErneuern(gruppeId)
    return anfrage<{ space_token: string }>(`groups/${gruppeId}/token`, { method: 'POST', gruppeId })
  },

  async mitgliedAnlegen(
    gruppeId: string,
    body: { display_name: string; color: string },
  ): Promise<Member> {
    if (!(await pruefeBackend())) return lokal.mitgliedAnlegen(gruppeId, body)
    return anfrage<Member>(`groups/${gruppeId}/members`, {
      method: 'POST',
      body: JSON.stringify(body),
      gruppeId,
    })
  },

  async mitgliedAendern(
    gruppeId: string,
    mitgliedId: string,
    body: { display_name?: string; color?: string; sort_order?: number; archived?: boolean },
  ): Promise<Member> {
    if (!(await pruefeBackend())) return lokal.mitgliedAendern(gruppeId, mitgliedId, body)
    return anfrage<Member>(`groups/${gruppeId}/members/${mitgliedId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      gruppeId,
    })
  },

  async mitgliedLoeschen(
    gruppeId: string,
    mitgliedId: string,
  ): Promise<{ geloescht?: true; archiviert?: true; grund?: string }> {
    if (!(await pruefeBackend())) return lokal.mitgliedLoeschen(gruppeId, mitgliedId)
    return anfrage<{ geloescht?: true; archiviert?: true; grund?: string }>(
      `groups/${gruppeId}/members/${mitgliedId}`,
      { method: 'DELETE', gruppeId },
    )
  },

  async belegAnlegen(gruppeId: string, body: unknown): Promise<Receipt> {
    if (!(await pruefeBackend())) return lokal.belegSpeichern(gruppeId, undefined, body as never)
    return anfrage<Receipt>(`groups/${gruppeId}/receipts`, {
      method: 'POST',
      body: JSON.stringify(body),
      gruppeId,
    })
  },

  async belegErsetzen(gruppeId: string, belegId: string, body: unknown): Promise<Receipt> {
    if (!(await pruefeBackend())) return lokal.belegSpeichern(gruppeId, belegId, body as never)
    return anfrage<Receipt>(`groups/${gruppeId}/receipts/${belegId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
      gruppeId,
    })
  },

  async belegLoeschen(gruppeId: string, belegId: string): Promise<{ geloescht: true }> {
    if (!(await pruefeBackend())) return lokal.belegLoeschen(gruppeId, belegId)
    return anfrage<{ geloescht: true }>(`groups/${gruppeId}/receipts/${belegId}`, {
      method: 'DELETE',
      gruppeId,
    })
  },

  async ausgleichAnlegen(
    gruppeId: string,
    body: { from_id: string; to_id: string; amount_cents: number },
  ): Promise<Settlement> {
    if (!(await pruefeBackend())) return lokal.ausgleichAnlegen(gruppeId, body)
    return anfrage<Settlement>(`groups/${gruppeId}/settlements`, {
      method: 'POST',
      body: JSON.stringify(body),
      gruppeId,
    })
  },

  async ausgleichLoeschen(gruppeId: string, ausgleichId: string): Promise<{ geloescht: true }> {
    if (!(await pruefeBackend())) return lokal.ausgleichLoeschen(gruppeId, ausgleichId)
    return anfrage<{ geloescht: true }>(`groups/${gruppeId}/settlements/${ausgleichId}`, {
      method: 'DELETE',
      gruppeId,
    })
  },

  async budgetAnlegen(gruppeId: string, body: unknown): Promise<Budget> {
    if (!(await pruefeBackend())) return lokal.budgetSpeichern(gruppeId, undefined, body as never)
    return anfrage<Budget>(`groups/${gruppeId}/budgets`, {
      method: 'POST',
      body: JSON.stringify(body),
      gruppeId,
    })
  },

  async budgetAendern(gruppeId: string, budgetId: string, body: unknown): Promise<Budget> {
    if (!(await pruefeBackend())) return lokal.budgetSpeichern(gruppeId, budgetId, body as never)
    return anfrage<Budget>(`groups/${gruppeId}/budgets/${budgetId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
      gruppeId,
    })
  },

  async budgetLoeschen(gruppeId: string, budgetId: string): Promise<{ geloescht: true }> {
    if (!(await pruefeBackend())) return lokal.budgetLoeschen(gruppeId, budgetId)
    return anfrage<{ geloescht: true }>(`groups/${gruppeId}/budgets/${budgetId}`, {
      method: 'DELETE',
      gruppeId,
    })
  },

  /**
   * Exchange rates. Always from the server — /api/fx needs neither database
   * nor token, so it answers even when everything else runs locally.
   */
  kurse: (basis: string) =>
    anfrage<{ base: string; date: string; rates: Record<string, number>; stale?: boolean }>(
      `fx?base=${encodeURIComponent(basis)}`,
    ),
}
