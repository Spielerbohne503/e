import type { z } from 'zod'
import {
  CreateGroupInput,
  CreateMemberInput,
  CreateSettlementInput,
  SaveBudgetInput,
  SaveReceiptInput,
  UpdateGroupInput,
  UpdateMemberInput,
} from '../../src/shared/api'
import type { Env, Handler, Route } from '../lib/http'
import {
  fehler,
  findeRoute,
  gleichSicher,
  hashe,
  jetzt,
  json,
  keinZugriff,
  leseKoerper,
  neueId,
  neuerSpaceToken,
  nichtGefunden,
} from '../lib/http'
import {
  alleGehoerenZurGruppe,
  bumpRevision,
  gehoertZurGruppe,
  ladeGruppePerToken,
  ladeGruppeRoh,
  ladeSnapshot,
  oeffentlicheGruppe,
} from '../lib/db'
import { holeKurse } from '../lib/fx'

/**
 * The whole API. One catch-all handler with a small router, so the token
 * check lives in exactly one place and cannot be forgotten on a new endpoint.
 *
 * Access rule: the token is the only credential. A request either carries a
 * token that matches the group it addresses, or it gets 403. There is no
 * user, no session and no other way in.
 */

const TOKEN_HEADER = 'x-quitt-token'
const PIN_HEADER = 'x-quitt-pin'

/* ------------------------------------------------------------------ *
 * Groups
 * ------------------------------------------------------------------ */

/** Creating a group is the one write that runs without a token — it mints one. */
const gruppeAnlegen: Handler = async ({ request, env }) => {
  const body = await leseKoerper(request, CreateGroupInput)
  if (body instanceof Response) return body

  const id = neueId('g')
  const token = neuerSpaceToken()
  const zeit = jetzt()

  const anweisungen: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO groups (id, space_token, name, base_currency, netting_mode, show_zetti, revision, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'graph', 1, 1, ?, ?)`,
    ).bind(id, token, body.name.trim(), body.base_currency, zeit, zeit),
  ]

  body.members?.forEach((m, i) => {
    anweisungen.push(
      env.DB.prepare(
        `INSERT INTO members (id, group_id, display_name, color, sort_order, archived)
         VALUES (?, ?, ?, ?, ?, 0)`,
      ).bind(neueId('m'), id, m.display_name.trim(), m.color, i),
    )
  })

  await env.DB.batch(anweisungen)

  const row = await ladeGruppeRoh(env, id)
  if (!row) return fehler('Die Gruppe konnte nicht angelegt werden', 500)

  // The token is returned exactly once, here. After this it only ever travels
  // in the header, and the client keeps it in local storage.
  return json({ ...(await ladeSnapshot(env, row)), space_token: token }, 201)
}

/**
 * The entry point for a sync link: the client has a token but does not know
 * which group it belongs to yet. Resolving it here is what makes opening
 * `#s=<token>` on a second device work.
 */
const spaceLesen: Handler = async ({ request, env }) => {
  const token = request.headers.get(TOKEN_HEADER)
  if (!token) return keinZugriff()

  const row = await ladeGruppePerToken(env, token)
  if (!row) return keinZugriff()

  if (row.pin_hash) {
    const pin = request.headers.get(PIN_HEADER)
    if (!pin || !gleichSicher(await hashe(pin), row.pin_hash)) {
      return fehler('PIN erforderlich', 401)
    }
  }

  return json(await ladeSnapshot(env, row))
}

const snapshotLesen: Handler = async ({ env, params }) => {
  const row = await ladeGruppeRoh(env, params.id!)
  if (!row) return nichtGefunden()
  return json(await ladeSnapshot(env, row))
}

/** The cheap poll: one integer instead of the whole group. */
const revisionLesen: Handler = async ({ env, params }) => {
  const row = await env.DB.prepare('SELECT revision FROM groups WHERE id = ?')
    .bind(params.id)
    .first<{ revision: number }>()
  if (!row) return nichtGefunden()
  return json({ revision: row.revision })
}

const gruppeAendern: Handler = async ({ request, env, params }) => {
  const body = await leseKoerper(request, UpdateGroupInput)
  if (body instanceof Response) return body

  const felder: string[] = []
  const werte: unknown[] = []

  if (body.name !== undefined) {
    felder.push('name = ?')
    werte.push(body.name.trim())
  }
  if (body.base_currency !== undefined) {
    felder.push('base_currency = ?')
    werte.push(body.base_currency)
  }
  if (body.netting_mode !== undefined) {
    felder.push('netting_mode = ?')
    werte.push(body.netting_mode)
  }
  if (body.show_zetti !== undefined) {
    felder.push('show_zetti = ?')
    werte.push(body.show_zetti ? 1 : 0)
  }
  if (body.pin !== undefined) {
    felder.push('pin_hash = ?')
    werte.push(body.pin === null ? null : await hashe(body.pin))
  }

  if (felder.length === 0) return fehler('Nichts zu ändern')

  felder.push('revision = revision + 1', 'updated_at = ?')
  werte.push(jetzt(), params.id)

  await env.DB.prepare(`UPDATE groups SET ${felder.join(', ')} WHERE id = ?`)
    .bind(...werte)
    .run()

  const row = await ladeGruppeRoh(env, params.id!)
  return row ? json(oeffentlicheGruppe(row)) : nichtGefunden()
}

const gruppeLoeschen: Handler = async ({ env, params }) => {
  // Foreign keys cascade, so this clears members, receipts, items and splits.
  await env.DB.prepare('DELETE FROM groups WHERE id = ?').bind(params.id).run()
  return json({ geloescht: true })
}

/** Rotating the token invalidates every link that was shared before. */
const tokenErneuern: Handler = async ({ env, params }) => {
  const token = neuerSpaceToken()
  await env.DB.prepare(
    'UPDATE groups SET space_token = ?, revision = revision + 1, updated_at = ? WHERE id = ?',
  )
    .bind(token, jetzt(), params.id)
    .run()
  return json({ space_token: token })
}

/* ------------------------------------------------------------------ *
 * Members
 * ------------------------------------------------------------------ */

const mitgliedAnlegen: Handler = async ({ request, env, params }) => {
  const body = await leseKoerper(request, CreateMemberInput)
  if (body instanceof Response) return body

  const naechste = await env.DB.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM members WHERE group_id = ?',
  )
    .bind(params.id)
    .first<{ n: number }>()

  const id = neueId('m')
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO members (id, group_id, display_name, color, sort_order, archived)
       VALUES (?, ?, ?, ?, ?, 0)`,
    ).bind(id, params.id, body.display_name.trim(), body.color, body.sort_order ?? naechste?.n ?? 0),
    bumpRevision(env, params.id!),
  ])

  const row = await env.DB.prepare('SELECT * FROM members WHERE id = ?').bind(id).first()
  return json(row, 201)
}

const mitgliedAendern: Handler = async ({ request, env, params }) => {
  const body = await leseKoerper(request, UpdateMemberInput)
  if (body instanceof Response) return body
  if (!(await gehoertZurGruppe(env, params.id!, params.mid!))) return nichtGefunden()

  const felder: string[] = []
  const werte: unknown[] = []

  if (body.display_name !== undefined) {
    felder.push('display_name = ?')
    werte.push(body.display_name.trim())
  }
  if (body.color !== undefined) {
    felder.push('color = ?')
    werte.push(body.color)
  }
  if (body.sort_order !== undefined) {
    felder.push('sort_order = ?')
    werte.push(body.sort_order)
  }
  if (body.archived !== undefined) {
    felder.push('archived = ?')
    werte.push(body.archived ? 1 : 0)
  }

  if (felder.length === 0) return fehler('Nichts zu ändern')
  werte.push(params.mid)

  await env.DB.batch([
    env.DB.prepare(`UPDATE members SET ${felder.join(', ')} WHERE id = ?`).bind(...werte),
    bumpRevision(env, params.id!),
  ])

  const row = await env.DB.prepare('SELECT * FROM members WHERE id = ?').bind(params.mid).first()
  return json(row)
}

/**
 * A person who already paid for something cannot simply vanish — their
 * receipts would lose their payer. Those get archived instead, which keeps
 * the history intact and hides them from new assignments.
 */
const mitgliedLoeschen: Handler = async ({ env, params }) => {
  if (!(await gehoertZurGruppe(env, params.id!, params.mid!))) return nichtGefunden()

  const belege = await env.DB.prepare('SELECT COUNT(*) AS n FROM receipts WHERE payer_id = ?')
    .bind(params.mid)
    .first<{ n: number }>()

  if ((belege?.n ?? 0) > 0) {
    await env.DB.batch([
      env.DB.prepare('UPDATE members SET archived = 1 WHERE id = ?').bind(params.mid),
      bumpRevision(env, params.id!),
    ])
    return json({ archiviert: true, grund: 'Die Person hat Belege bezahlt und bleibt im Verlauf' })
  }

  await env.DB.batch([
    env.DB.prepare('DELETE FROM members WHERE id = ?').bind(params.mid),
    bumpRevision(env, params.id!),
  ])
  return json({ geloescht: true })
}

/* ------------------------------------------------------------------ *
 * Receipts
 * ------------------------------------------------------------------ */

/**
 * Writes a receipt with its items and splits as one batch. D1 batches run in
 * a transaction, so a receipt never lands half-written.
 */
async function schreibeBeleg(
  env: Env,
  groupId: string,
  receiptId: string,
  body: z.output<typeof SaveReceiptInput>,
  neu: boolean,
): Promise<Response> {
  if (!(await gehoertZurGruppe(env, groupId, body.payer_id))) {
    return fehler('Der Zahler gehört nicht zu dieser Gruppe', 422, 'payer_id')
  }

  const mitglieder = body.items.flatMap((i) => i.splits.map((s) => s.member_id))
  if (!(await alleGehoerenZurGruppe(env, groupId, mitglieder))) {
    return fehler('Eine zugeordnete Person gehört nicht zu dieser Gruppe', 422, 'items')
  }

  const zeit = jetzt()
  const anweisungen: D1PreparedStatement[] = []

  if (neu) {
    anweisungen.push(
      env.DB.prepare(
        `INSERT INTO receipts (id, group_id, payer_id, merchant, date, note, currency,
                               fx_rate_to_base, fx_date, total_cents, source, raw_json,
                               created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        receiptId,
        groupId,
        body.payer_id,
        body.merchant ?? null,
        body.date ?? null,
        body.note ?? null,
        body.currency,
        body.fx_rate_to_base,
        body.fx_date ?? new Date().toISOString().slice(0, 10),
        body.total_cents,
        body.source,
        body.raw_json ?? null,
        zeit,
        zeit,
      ),
    )
  } else {
    anweisungen.push(
      env.DB.prepare(
        `UPDATE receipts SET payer_id = ?, merchant = ?, date = ?, note = ?, currency = ?,
                             fx_rate_to_base = ?, fx_date = ?, total_cents = ?, source = ?,
                             raw_json = ?, updated_at = ?
         WHERE id = ? AND group_id = ?`,
      ).bind(
        body.payer_id,
        body.merchant ?? null,
        body.date ?? null,
        body.note ?? null,
        body.currency,
        body.fx_rate_to_base,
        body.fx_date ?? new Date().toISOString().slice(0, 10),
        body.total_cents,
        body.source,
        body.raw_json ?? null,
        zeit,
        receiptId,
        groupId,
      ),
      // Replacing the lines wholesale is simpler than diffing them, and the
      // cascade takes the splits with them.
      env.DB.prepare('DELETE FROM items WHERE receipt_id = ?').bind(receiptId),
    )
  }

  for (const item of body.items) {
    const itemId = neueId('i')
    anweisungen.push(
      env.DB.prepare(
        `INSERT INTO items (id, receipt_id, name, name_original, qty, total_cents, kind, category, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        itemId,
        receiptId,
        item.name,
        item.name_original ?? null,
        item.qty,
        item.total_cents,
        item.kind,
        item.category ?? null,
        item.sort_order,
      ),
    )

    for (const split of item.splits) {
      anweisungen.push(
        env.DB.prepare(
          `INSERT INTO splits (id, item_id, member_id, mode, value) VALUES (?, ?, ?, ?, ?)`,
        ).bind(neueId('s'), itemId, split.member_id, split.mode, split.value),
      )
    }
  }

  anweisungen.push(bumpRevision(env, groupId))
  await env.DB.batch(anweisungen)

  const row = await ladeGruppeRoh(env, groupId)
  if (!row) return nichtGefunden()
  const snapshot = await ladeSnapshot(env, row)
  const beleg = snapshot.receipts.find((r) => r.id === receiptId)
  return json(beleg ?? null, neu ? 201 : 200)
}

const belegAnlegen: Handler = async ({ request, env, params }) => {
  const body = await leseKoerper(request, SaveReceiptInput)
  if (body instanceof Response) return body
  return schreibeBeleg(env, params.id!, neueId('r'), body, true)
}

const belegErsetzen: Handler = async ({ request, env, params }) => {
  const body = await leseKoerper(request, SaveReceiptInput)
  if (body instanceof Response) return body

  const da = await env.DB.prepare('SELECT 1 AS da FROM receipts WHERE id = ? AND group_id = ?')
    .bind(params.rid, params.id)
    .first()
  if (!da) return nichtGefunden()

  return schreibeBeleg(env, params.id!, params.rid!, body, false)
}

const belegLoeschen: Handler = async ({ env, params }) => {
  const ergebnis = await env.DB.prepare('DELETE FROM receipts WHERE id = ? AND group_id = ?')
    .bind(params.rid, params.id)
    .run()
  if (ergebnis.meta.changes === 0) return nichtGefunden()
  await bumpRevision(env, params.id!).run()
  return json({ geloescht: true })
}

/* ------------------------------------------------------------------ *
 * Settlements
 * ------------------------------------------------------------------ */

const ausgleichAnlegen: Handler = async ({ request, env, params }) => {
  const body = await leseKoerper(request, CreateSettlementInput)
  if (body instanceof Response) return body

  if (body.from_id === body.to_id) {
    return fehler('Eine Zahlung an sich selbst ergibt keinen Sinn', 422, 'to_id')
  }
  if (!(await alleGehoerenZurGruppe(env, params.id!, [body.from_id, body.to_id]))) {
    return fehler('Eine der beiden Personen gehört nicht zu dieser Gruppe', 422)
  }

  const id = neueId('a')
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO settlements (id, group_id, from_id, to_id, amount_cents, settled_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(id, params.id, body.from_id, body.to_id, body.amount_cents, body.settled_at ?? jetzt()),
    bumpRevision(env, params.id!),
  ])

  const row = await env.DB.prepare('SELECT * FROM settlements WHERE id = ?').bind(id).first()
  return json(row, 201)
}

const ausgleichLoeschen: Handler = async ({ env, params }) => {
  const ergebnis = await env.DB.prepare('DELETE FROM settlements WHERE id = ? AND group_id = ?')
    .bind(params.sid, params.id)
    .run()
  if (ergebnis.meta.changes === 0) return nichtGefunden()
  await bumpRevision(env, params.id!).run()
  return json({ geloescht: true })
}

/* ------------------------------------------------------------------ *
 * Budgets
 * ------------------------------------------------------------------ */

const budgetAnlegen: Handler = async ({ request, env, params }) => {
  const body = await leseKoerper(request, SaveBudgetInput)
  if (body instanceof Response) return body

  const id = neueId('b')
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO budgets (id, group_id, amount_cents, currency, period, starts_on, ends_on, categories, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      params.id,
      body.amount_cents,
      body.currency,
      body.period,
      body.starts_on,
      body.ends_on ?? null,
      body.categories ? JSON.stringify(body.categories) : null,
      body.active === false ? 0 : 1,
    ),
    bumpRevision(env, params.id!),
  ])

  const row = await env.DB.prepare('SELECT * FROM budgets WHERE id = ?').bind(id).first()
  return json(row, 201)
}

const budgetAendern: Handler = async ({ request, env, params }) => {
  const body = await leseKoerper(request, SaveBudgetInput)
  if (body instanceof Response) return body

  const ergebnis = await env.DB.prepare(
    `UPDATE budgets SET amount_cents = ?, currency = ?, period = ?, starts_on = ?,
                        ends_on = ?, categories = ?, active = ?
     WHERE id = ? AND group_id = ?`,
  )
    .bind(
      body.amount_cents,
      body.currency,
      body.period,
      body.starts_on,
      body.ends_on ?? null,
      body.categories ? JSON.stringify(body.categories) : null,
      body.active === false ? 0 : 1,
      params.bid,
      params.id,
    )
    .run()

  if (ergebnis.meta.changes === 0) return nichtGefunden()
  await bumpRevision(env, params.id!).run()

  const row = await env.DB.prepare('SELECT * FROM budgets WHERE id = ?').bind(params.bid).first()
  return json(row)
}

const budgetLoeschen: Handler = async ({ env, params }) => {
  const ergebnis = await env.DB.prepare('DELETE FROM budgets WHERE id = ? AND group_id = ?')
    .bind(params.bid, params.id)
    .run()
  if (ergebnis.meta.changes === 0) return nichtGefunden()
  await bumpRevision(env, params.id!).run()
  return json({ geloescht: true })
}

/* ------------------------------------------------------------------ *
 * Exchange rates
 * ------------------------------------------------------------------ */

/**
 * Rates come from the KV cache, refreshed at most once a day. Public because
 * a rate is not private, and the picker needs it before a group exists.
 */
const kurseLesen: Handler = async ({ env, url }) => {
  const basis = (url.searchParams.get('base') ?? 'EUR').toUpperCase()
  if (!/^[A-Z]{3}$/.test(basis)) return fehler('Basiswährung als ISO-4217-Code erwartet', 422, 'base')

  try {
    const { kurse, stale } = await holeKurse(env, basis)
    return json({ base: kurse.base, date: kurse.date, rates: kurse.rates, stale })
  } catch {
    return fehler('Es sind gerade keine Kurse verfügbar', 503)
  }
}

/* ------------------------------------------------------------------ *
 * Routing
 * ------------------------------------------------------------------ */

const ROUTES: Route[] = [
  { method: 'POST', pattern: 'groups', handler: gruppeAnlegen, oeffentlich: true },
  // Checks the token itself, so it is listed as public to the middleware.
  { method: 'GET', pattern: 'space', handler: spaceLesen, oeffentlich: true },
  { method: 'GET', pattern: 'fx', handler: kurseLesen, oeffentlich: true },
  { method: 'GET', pattern: 'groups/:id', handler: snapshotLesen },
  { method: 'PATCH', pattern: 'groups/:id', handler: gruppeAendern },
  { method: 'DELETE', pattern: 'groups/:id', handler: gruppeLoeschen },
  { method: 'GET', pattern: 'groups/:id/revision', handler: revisionLesen },
  { method: 'POST', pattern: 'groups/:id/token', handler: tokenErneuern },

  { method: 'POST', pattern: 'groups/:id/members', handler: mitgliedAnlegen },
  { method: 'PATCH', pattern: 'groups/:id/members/:mid', handler: mitgliedAendern },
  { method: 'DELETE', pattern: 'groups/:id/members/:mid', handler: mitgliedLoeschen },

  { method: 'POST', pattern: 'groups/:id/receipts', handler: belegAnlegen },
  { method: 'PUT', pattern: 'groups/:id/receipts/:rid', handler: belegErsetzen },
  { method: 'DELETE', pattern: 'groups/:id/receipts/:rid', handler: belegLoeschen },

  { method: 'POST', pattern: 'groups/:id/settlements', handler: ausgleichAnlegen },
  { method: 'DELETE', pattern: 'groups/:id/settlements/:sid', handler: ausgleichLoeschen },

  { method: 'POST', pattern: 'groups/:id/budgets', handler: budgetAnlegen },
  { method: 'PUT', pattern: 'groups/:id/budgets/:bid', handler: budgetAendern },
  { method: 'DELETE', pattern: 'groups/:id/budgets/:bid', handler: budgetLoeschen },
]

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const pfad = url.pathname.replace(/^\/api\/?/, '')
  const treffer = findeRoute(ROUTES, context.request.method, pfad)

  if (!treffer) return nichtGefunden()

  const { route, params } = treffer
  const ctx = { request: context.request, env: context.env, params, url }

  if (route.oeffentlich) return route.handler(ctx)

  // Everything else needs a token that matches the group in the path.
  const token = context.request.headers.get(TOKEN_HEADER)
  if (!token) return keinZugriff()

  const gruppe = await ladeGruppePerToken(context.env, token)
  if (!gruppe || gruppe.id !== params.id) return keinZugriff()

  // The optional PIN is a second lock on the same door, checked in constant time.
  if (gruppe.pin_hash) {
    const pin = context.request.headers.get(PIN_HEADER)
    if (!pin || !gleichSicher(await hashe(pin), gruppe.pin_hash)) {
      return fehler('PIN erforderlich', 401)
    }
  }

  try {
    return await route.handler(ctx)
  } catch (e) {
    // Never leak a stack trace to the client; the message stays factual.
    console.error('API-Fehler', e)
    return fehler('Da ist etwas schiefgegangen', 500)
  }
}
