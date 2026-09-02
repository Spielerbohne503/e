import type { Env } from './http'
import { jetzt } from './http'
import type { Budget, Group, Item, Member, Receipt, Settlement, Snapshot, Split } from '../../src/shared/api'

/**
 * D1 access. Every read is scoped by group id, and the caller has already
 * proven it holds that group's token — the middleware does not let anything
 * else through.
 */

interface GroupRow {
  id: string
  space_token: string
  name: string
  base_currency: string
  netting_mode: 'graph' | 'direct'
  pin_hash: string | null
  show_zetti: number
  revision: number
  created_at: number
  updated_at: number
}

/** The row as stored, including the token and PIN hash — never sent to a client. */
export async function ladeGruppeRoh(env: Env, id: string): Promise<GroupRow | null> {
  return await env.DB.prepare('SELECT * FROM groups WHERE id = ?').bind(id).first<GroupRow>()
}

export async function ladeGruppePerToken(env: Env, token: string): Promise<GroupRow | null> {
  return await env.DB.prepare('SELECT * FROM groups WHERE space_token = ?')
    .bind(token)
    .first<GroupRow>()
}

/** Strips the secrets before a group crosses the wire. */
export function oeffentlicheGruppe(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    base_currency: row.base_currency,
    netting_mode: row.netting_mode,
    show_zetti: row.show_zetti,
    has_pin: row.pin_hash !== null,
    revision: row.revision,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/**
 * Bumped on every write. The client polls this number rather than the whole
 * snapshot, so a quiet group costs one integer every fifteen seconds.
 */
export function bumpRevision(env: Env, groupId: string): D1PreparedStatement {
  return env.DB.prepare('UPDATE groups SET revision = revision + 1, updated_at = ? WHERE id = ?').bind(
    jetzt(),
    groupId,
  )
}

/** Everything about one group, assembled in four queries. */
export async function ladeSnapshot(env: Env, row: GroupRow): Promise<Snapshot> {
  const [members, receipts, items, splits, settlements, budgets] = await Promise.all([
    env.DB.prepare('SELECT * FROM members WHERE group_id = ? ORDER BY sort_order, rowid')
      .bind(row.id)
      .all<Member>(),
    env.DB.prepare(
      'SELECT * FROM receipts WHERE group_id = ? ORDER BY COALESCE(date, "") DESC, created_at DESC',
    )
      .bind(row.id)
      .all<Omit<Receipt, 'items'>>(),
    env.DB.prepare(
      `SELECT i.* FROM items i
       JOIN receipts r ON r.id = i.receipt_id
       WHERE r.group_id = ?
       ORDER BY i.sort_order, i.rowid`,
    )
      .bind(row.id)
      .all<Omit<Item, 'splits'>>(),
    env.DB.prepare(
      `SELECT s.* FROM splits s
       JOIN items i ON i.id = s.item_id
       JOIN receipts r ON r.id = i.receipt_id
       WHERE r.group_id = ?`,
    )
      .bind(row.id)
      .all<Split>(),
    env.DB.prepare('SELECT * FROM settlements WHERE group_id = ? ORDER BY settled_at DESC')
      .bind(row.id)
      .all<Settlement>(),
    env.DB.prepare('SELECT * FROM budgets WHERE group_id = ? ORDER BY rowid')
      .bind(row.id)
      .all<Budget>(),
  ])

  // Stitch splits onto items and items onto receipts in one pass each.
  const splitsNachItem = new Map<string, Split[]>()
  for (const s of splits.results) {
    const liste = splitsNachItem.get(s.item_id)
    if (liste) liste.push(s)
    else splitsNachItem.set(s.item_id, [s])
  }

  const itemsNachBeleg = new Map<string, Item[]>()
  for (const i of items.results) {
    const voll: Item = { ...i, splits: splitsNachItem.get(i.id) ?? [] }
    const liste = itemsNachBeleg.get(i.receipt_id)
    if (liste) liste.push(voll)
    else itemsNachBeleg.set(i.receipt_id, [voll])
  }

  return {
    group: oeffentlicheGruppe(row),
    members: members.results,
    receipts: receipts.results.map((r) => ({ ...r, items: itemsNachBeleg.get(r.id) ?? [] })),
    settlements: settlements.results,
    budgets: budgets.results,
  }
}

/** True when the member belongs to this group. Guards every foreign key we accept. */
export async function gehoertZurGruppe(env: Env, groupId: string, memberId: string): Promise<boolean> {
  const row = await env.DB.prepare('SELECT 1 AS da FROM members WHERE id = ? AND group_id = ?')
    .bind(memberId, groupId)
    .first<{ da: number }>()
  return row !== null
}

export async function alleGehoerenZurGruppe(
  env: Env,
  groupId: string,
  memberIds: string[],
): Promise<boolean> {
  const eindeutig = [...new Set(memberIds)]
  if (eindeutig.length === 0) return true

  const platzhalter = eindeutig.map(() => '?').join(',')
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS anzahl FROM members WHERE group_id = ? AND id IN (${platzhalter})`,
  )
    .bind(groupId, ...eindeutig)
    .first<{ anzahl: number }>()

  return row?.anzahl === eindeutig.length
}
