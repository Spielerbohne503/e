import type { Budget, Group, Member, Receipt, Settlement, Snapshot } from '@/shared/api'
import { newId, newSpaceToken } from '@/lib/ids'

/**
 * A local backend, stored in this browser.
 *
 * Used when the Worker reports no database — the app then works fully on one
 * device instead of showing a setup notice and nothing else. Everything but
 * sync between devices behaves exactly as it does against D1, because both
 * sides speak the same Snapshot shape and the calculation core does not care
 * where the data came from.
 *
 * Once D1 is configured the app switches back on its own; local groups stay
 * where they are and can be pushed up later.
 */

const SCHLUESSEL = 'quitt.lokal'

interface LokalerStand {
  gruppen: Record<string, Snapshot>
  /** Group id by token, so a local sync link still resolves. */
  token: Record<string, string>
}

function lies(): LokalerStand {
  try {
    const roh = localStorage.getItem(SCHLUESSEL)
    if (!roh) return { gruppen: {}, token: {} }
    const stand = JSON.parse(roh) as LokalerStand
    return { gruppen: stand.gruppen ?? {}, token: stand.token ?? {} }
  } catch {
    return { gruppen: {}, token: {} }
  }
}

function schreib(stand: LokalerStand): void {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(stand))
  } catch {
    // Storage full or blocked. Nothing sensible to do beyond carrying on.
  }
}

/** Every write bumps the revision, exactly like the Worker does. */
function aendere(gruppeId: string, arbeit: (s: Snapshot) => void): Snapshot {
  const stand = lies()
  const snapshot = stand.gruppen[gruppeId]
  if (!snapshot) throw new Error('Diese Gruppe gibt es nicht')

  arbeit(snapshot)
  snapshot.group.revision += 1
  snapshot.group.updated_at = Date.now()

  schreib(stand)
  return snapshot
}

function hole(gruppeId: string): Snapshot {
  const snapshot = lies().gruppen[gruppeId]
  if (!snapshot) throw new Error('Diese Gruppe gibt es nicht')
  return snapshot
}

export const lokal = {
  gruppeAnlegen(body: {
    name: string
    base_currency: string
    members?: Array<{ display_name: string; color: string }>
  }): Snapshot & { space_token: string } {
    const stand = lies()
    const id = newId('g')
    const token = newSpaceToken()
    const jetzt = Date.now()

    const group: Group = {
      id,
      name: body.name.trim(),
      base_currency: body.base_currency,
      netting_mode: 'graph',
      show_zetti: 1,
      has_pin: false,
      revision: 1,
      created_at: jetzt,
      updated_at: jetzt,
    }

    const members: Member[] = (body.members ?? []).map((m, i) => ({
      id: newId('m'),
      group_id: id,
      display_name: m.display_name.trim(),
      color: m.color,
      sort_order: i,
      archived: 0,
    }))

    const snapshot: Snapshot = { group, members, receipts: [], settlements: [], budgets: [] }
    stand.gruppen[id] = snapshot
    stand.token[token] = id
    schreib(stand)

    return { ...snapshot, space_token: token }
  },

  snapshot: (gruppeId: string): Snapshot => hole(gruppeId),

  revision: (gruppeId: string): { revision: number } => ({ revision: hole(gruppeId).group.revision }),

  /** Resolves a local sync link. Only works on the device that made it. */
  space(token: string): Snapshot | null {
    const stand = lies()
    const id = stand.token[token]
    return id ? (stand.gruppen[id] ?? null) : null
  },

  gruppeAendern(
    gruppeId: string,
    body: {
      name?: string
      base_currency?: string
      netting_mode?: 'graph' | 'direct'
      show_zetti?: boolean
      pin?: string | null
    },
  ): Group {
    const snapshot = aendere(gruppeId, (s) => {
      if (body.name !== undefined) s.group.name = body.name.trim()
      if (body.base_currency !== undefined) s.group.base_currency = body.base_currency
      if (body.netting_mode !== undefined) s.group.netting_mode = body.netting_mode
      if (body.show_zetti !== undefined) s.group.show_zetti = body.show_zetti ? 1 : 0
      // A PIN protects against remote access, which local storage does not have.
      if (body.pin !== undefined) s.group.has_pin = body.pin !== null
    })
    return snapshot.group
  },

  gruppeLoeschen(gruppeId: string): { geloescht: true } {
    const stand = lies()
    delete stand.gruppen[gruppeId]
    for (const [token, id] of Object.entries(stand.token)) {
      if (id === gruppeId) delete stand.token[token]
    }
    schreib(stand)
    return { geloescht: true }
  },

  tokenErneuern(gruppeId: string): { space_token: string } {
    const stand = lies()
    for (const [token, id] of Object.entries(stand.token)) {
      if (id === gruppeId) delete stand.token[token]
    }
    const token = newSpaceToken()
    stand.token[token] = gruppeId
    schreib(stand)
    return { space_token: token }
  },

  mitgliedAnlegen(gruppeId: string, body: { display_name: string; color: string }): Member {
    let neu: Member | null = null
    aendere(gruppeId, (s) => {
      neu = {
        id: newId('m'),
        group_id: gruppeId,
        display_name: body.display_name.trim(),
        color: body.color,
        sort_order: s.members.length,
        archived: 0,
      }
      s.members.push(neu)
    })
    return neu!
  },

  mitgliedAendern(
    gruppeId: string,
    mitgliedId: string,
    body: { display_name?: string; color?: string; sort_order?: number; archived?: boolean },
  ): Member {
    let treffer: Member | null = null
    aendere(gruppeId, (s) => {
      const m = s.members.find((x) => x.id === mitgliedId)
      if (!m) throw new Error('Diese Person gibt es nicht')
      if (body.display_name !== undefined) m.display_name = body.display_name.trim()
      if (body.color !== undefined) m.color = body.color
      if (body.sort_order !== undefined) m.sort_order = body.sort_order
      if (body.archived !== undefined) m.archived = body.archived ? 1 : 0
      treffer = m
    })
    return treffer!
  },

  /** Same rule as the API: someone who paid gets archived, not deleted. */
  mitgliedLoeschen(
    gruppeId: string,
    mitgliedId: string,
  ): { geloescht?: true; archiviert?: true; grund?: string } {
    let antwort: { geloescht?: true; archiviert?: true; grund?: string } = { geloescht: true }
    aendere(gruppeId, (s) => {
      const hatBelege = s.receipts.some((r) => r.payer_id === mitgliedId)
      if (hatBelege) {
        const m = s.members.find((x) => x.id === mitgliedId)
        if (m) m.archived = 1
        antwort = {
          archiviert: true,
          grund: 'Die Person hat Belege bezahlt und bleibt im Verlauf',
        }
        return
      }
      s.members = s.members.filter((x) => x.id !== mitgliedId)
    })
    return antwort
  },

  belegSpeichern(gruppeId: string, belegId: string | undefined, body: RohBeleg): Receipt {
    const jetzt = Date.now()
    const id = belegId ?? newId('r')

    const beleg: Receipt = {
      id,
      group_id: gruppeId,
      payer_id: body.payer_id,
      merchant: body.merchant ?? null,
      date: body.date ?? null,
      note: body.note ?? null,
      currency: body.currency,
      fx_rate_to_base: body.fx_rate_to_base ?? 1,
      fx_date: body.fx_date ?? new Date().toISOString().slice(0, 10),
      total_cents: body.total_cents,
      source: body.source ?? 'manual',
      raw_json: body.raw_json ?? null,
      created_at: jetzt,
      updated_at: jetzt,
      items: body.items.map((item, i) => {
        const itemId = newId('i')
        return {
          id: itemId,
          receipt_id: id,
          name: item.name,
          name_original: item.name_original ?? null,
          qty: item.qty ?? 1,
          total_cents: item.total_cents,
          kind: item.kind ?? 'item',
          category: item.category ?? null,
          sort_order: item.sort_order ?? i,
          splits: (item.splits ?? []).map((sp) => ({
            id: newId('s'),
            item_id: itemId,
            member_id: sp.member_id,
            mode: sp.mode,
            value: sp.value,
          })),
        }
      }),
    }

    aendere(gruppeId, (s) => {
      const vorhanden = s.receipts.findIndex((r) => r.id === id)
      if (vorhanden >= 0) {
        beleg.created_at = s.receipts[vorhanden]!.created_at
        s.receipts[vorhanden] = beleg
      } else {
        s.receipts.unshift(beleg)
      }
      // Same ordering the API returns: newest date first.
      s.receipts.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.created_at - a.created_at)
    })

    return beleg
  },

  belegLoeschen(gruppeId: string, belegId: string): { geloescht: true } {
    aendere(gruppeId, (s) => {
      s.receipts = s.receipts.filter((r) => r.id !== belegId)
    })
    return { geloescht: true }
  },

  ausgleichAnlegen(
    gruppeId: string,
    body: { from_id: string; to_id: string; amount_cents: number },
  ): Settlement {
    const eintrag: Settlement = {
      id: newId('a'),
      group_id: gruppeId,
      from_id: body.from_id,
      to_id: body.to_id,
      amount_cents: body.amount_cents,
      settled_at: Date.now(),
    }
    aendere(gruppeId, (s) => {
      s.settlements.unshift(eintrag)
    })
    return eintrag
  },

  ausgleichLoeschen(gruppeId: string, ausgleichId: string): { geloescht: true } {
    aendere(gruppeId, (s) => {
      s.settlements = s.settlements.filter((x) => x.id !== ausgleichId)
    })
    return { geloescht: true }
  },

  budgetSpeichern(gruppeId: string, budgetId: string | undefined, body: RohBudget): Budget {
    const eintrag: Budget = {
      id: budgetId ?? newId('b'),
      group_id: gruppeId,
      amount_cents: body.amount_cents,
      currency: body.currency,
      period: body.period,
      starts_on: body.starts_on,
      ends_on: body.ends_on ?? null,
      categories: body.categories ? JSON.stringify(body.categories) : null,
      active: body.active === false ? 0 : 1,
    }
    aendere(gruppeId, (s) => {
      const vorhanden = s.budgets.findIndex((b) => b.id === eintrag.id)
      if (vorhanden >= 0) s.budgets[vorhanden] = eintrag
      else s.budgets.push(eintrag)
    })
    return eintrag
  },

  budgetLoeschen(gruppeId: string, budgetId: string): { geloescht: true } {
    aendere(gruppeId, (s) => {
      s.budgets = s.budgets.filter((b) => b.id !== budgetId)
    })
    return { geloescht: true }
  },
}

/* ------------------------------------------------------------------ *
 * Request shapes, mirroring the zod schemas the API validates against
 * ------------------------------------------------------------------ */

interface RohBeleg {
  payer_id: string
  merchant?: string | null
  date?: string | null
  note?: string | null
  currency: string
  fx_rate_to_base?: number
  fx_date?: string
  total_cents: number
  source?: 'manual' | 'import' | 'travel'
  raw_json?: string | null
  items: Array<{
    name: string
    name_original?: string | null
    qty?: number
    total_cents: number
    kind?: 'item' | 'tax' | 'tip' | 'deposit' | 'discount'
    category?: string | null
    sort_order?: number
    splits?: Array<{ member_id: string; mode: 'equal' | 'shares' | 'percent' | 'fixed'; value: number }>
  }>
}

interface RohBudget {
  amount_cents: number
  currency: string
  period: 'once' | 'weekly' | 'monthly'
  starts_on: string
  ends_on?: string | null
  categories?: string[] | null
  active?: boolean
}
