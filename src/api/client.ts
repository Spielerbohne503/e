import type {
  Budget,
  Group,
  Member,
  Receipt,
  Settlement,
  Snapshot,
} from '@/shared/api'
import { pinFuer, tokenFuer } from '@/lib/speicher'

/**
 * The API client. Every request but "create a group" carries the group's
 * token; without it the server answers 403 and the app shows read-only.
 */

export class ApiFehler extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly feld?: string,
  ) {
    super(message)
    this.name = 'ApiFehler'
  }

  /** 401 means a PIN is set and missing or wrong. */
  get brauchtPin(): boolean {
    return this.status === 401
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
    const body = daten as { fehler?: string; feld?: string } | null
    throw new ApiFehler(body?.fehler ?? 'Da ist etwas schiefgegangen', antwort.status, body?.feld)
  }

  return daten as T
}

/* ------------------------------------------------------------------ *
 * Groups
 * ------------------------------------------------------------------ */

export interface NeueGruppeAntwort extends Snapshot {
  /** Returned exactly once, when the group is created. */
  space_token: string
}

export const api = {
  gruppeAnlegen: (body: {
    name: string
    base_currency: string
    members?: Array<{ display_name: string; color: string }>
  }) => anfrage<NeueGruppeAntwort>('groups', { method: 'POST', body: JSON.stringify(body) }),

  snapshot: (gruppeId: string) => anfrage<Snapshot>(`groups/${gruppeId}`, { gruppeId }),

  /** One integer, for the fifteen-second poll. */
  revision: (gruppeId: string) =>
    anfrage<{ revision: number }>(`groups/${gruppeId}/revision`, { gruppeId }),

  gruppeAendern: (
    gruppeId: string,
    body: {
      name?: string
      base_currency?: string
      netting_mode?: 'graph' | 'direct'
      show_zetti?: boolean
      pin?: string | null
    },
  ) => anfrage<Group>(`groups/${gruppeId}`, { method: 'PATCH', body: JSON.stringify(body), gruppeId }),

  gruppeLoeschen: (gruppeId: string) =>
    anfrage<{ geloescht: true }>(`groups/${gruppeId}`, { method: 'DELETE', gruppeId }),

  tokenErneuern: (gruppeId: string) =>
    anfrage<{ space_token: string }>(`groups/${gruppeId}/token`, { method: 'POST', gruppeId }),

  mitgliedAnlegen: (gruppeId: string, body: { display_name: string; color: string }) =>
    anfrage<Member>(`groups/${gruppeId}/members`, {
      method: 'POST',
      body: JSON.stringify(body),
      gruppeId,
    }),

  mitgliedAendern: (
    gruppeId: string,
    mitgliedId: string,
    body: { display_name?: string; color?: string; sort_order?: number; archived?: boolean },
  ) =>
    anfrage<Member>(`groups/${gruppeId}/members/${mitgliedId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      gruppeId,
    }),

  mitgliedLoeschen: (gruppeId: string, mitgliedId: string) =>
    anfrage<{ geloescht?: true; archiviert?: true; grund?: string }>(
      `groups/${gruppeId}/members/${mitgliedId}`,
      { method: 'DELETE', gruppeId },
    ),

  belegAnlegen: (gruppeId: string, body: unknown) =>
    anfrage<Receipt>(`groups/${gruppeId}/receipts`, {
      method: 'POST',
      body: JSON.stringify(body),
      gruppeId,
    }),

  belegErsetzen: (gruppeId: string, belegId: string, body: unknown) =>
    anfrage<Receipt>(`groups/${gruppeId}/receipts/${belegId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
      gruppeId,
    }),

  belegLoeschen: (gruppeId: string, belegId: string) =>
    anfrage<{ geloescht: true }>(`groups/${gruppeId}/receipts/${belegId}`, {
      method: 'DELETE',
      gruppeId,
    }),

  ausgleichAnlegen: (
    gruppeId: string,
    body: { from_id: string; to_id: string; amount_cents: number },
  ) =>
    anfrage<Settlement>(`groups/${gruppeId}/settlements`, {
      method: 'POST',
      body: JSON.stringify(body),
      gruppeId,
    }),

  ausgleichLoeschen: (gruppeId: string, ausgleichId: string) =>
    anfrage<{ geloescht: true }>(`groups/${gruppeId}/settlements/${ausgleichId}`, {
      method: 'DELETE',
      gruppeId,
    }),

  budgetAnlegen: (gruppeId: string, body: unknown) =>
    anfrage<Budget>(`groups/${gruppeId}/budgets`, {
      method: 'POST',
      body: JSON.stringify(body),
      gruppeId,
    }),

  budgetAendern: (gruppeId: string, budgetId: string, body: unknown) =>
    anfrage<Budget>(`groups/${gruppeId}/budgets/${budgetId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
      gruppeId,
    }),

  budgetLoeschen: (gruppeId: string, budgetId: string) =>
    anfrage<{ geloescht: true }>(`groups/${gruppeId}/budgets/${budgetId}`, {
      method: 'DELETE',
      gruppeId,
    }),

  /** Exchange rates, served from the KV cache. */
  kurse: (basis: string) =>
    anfrage<{ base: string; date: string; rates: Record<string, number>; stale?: boolean }>(
      `fx?base=${encodeURIComponent(basis)}`,
    ),
}
