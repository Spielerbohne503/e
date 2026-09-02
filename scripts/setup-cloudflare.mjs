#!/usr/bin/env node
/**
 * One-shot Cloudflare setup.
 *
 * Creates the D1 database and the KV namespace if they do not exist yet, then
 * writes their ids straight into wrangler.toml. Saves copying two ids by hand
 * — which is exactly where the first deploy fell over.
 *
 * Safe to run twice: existing resources are reused, not duplicated.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const KONFIG = 'wrangler.toml'
const D1_NAME = 'quitt'
const KV_NAME = 'FX'

const grau = (t) => `\x1b[2m${t}\x1b[0m`
const gruen = (t) => `\x1b[32m${t}\x1b[0m`
const gelb = (t) => `\x1b[33m${t}\x1b[0m`
const rot = (t) => `\x1b[31m${t}\x1b[0m`

function wrangler(args, { leise = false } = {}) {
  try {
    return execFileSync('npx', ['wrangler', ...args], {
      encoding: 'utf8',
      stdio: leise ? ['ignore', 'pipe', 'pipe'] : ['inherit', 'pipe', 'pipe'],
    })
  } catch (e) {
    const ausgabe = `${e.stdout ?? ''}${e.stderr ?? ''}`
    throw new Error(ausgabe.trim() || e.message)
  }
}

/** Pulls an id out of whatever shape wrangler printed it in. */
function findeId(text, ...schluessel) {
  for (const s of schluessel) {
    // Matches: database_id = "abc", "id": "abc", id = abc
    const treffer = new RegExp(`${s}\\s*[:=]\\s*"?([0-9a-f-]{32,36})"?`, 'i').exec(text)
    if (treffer) return treffer[1]
  }
  return null
}

function d1Anlegen() {
  process.stdout.write(grau('D1-Datenbank … '))

  // Reuse an existing one rather than failing on the second run.
  try {
    const liste = JSON.parse(wrangler(['d1', 'list', '--json'], { leise: true }))
    const da = liste.find((d) => d.name === D1_NAME)
    if (da) {
      console.log(gruen(`gefunden (${da.uuid})`))
      return da.uuid
    }
  } catch {
    // No list available (not logged in yet, or an older wrangler) — try creating.
  }

  const ausgabe = wrangler(['d1', 'create', D1_NAME], { leise: true })
  const id = findeId(ausgabe, 'database_id', 'uuid')
  if (!id) throw new Error(`Konnte die database_id nicht aus der Ausgabe lesen:\n${ausgabe}`)
  console.log(gruen(`angelegt (${id})`))
  return id
}

function kvAnlegen() {
  process.stdout.write(grau('KV-Namespace … '))

  try {
    const liste = JSON.parse(wrangler(['kv', 'namespace', 'list'], { leise: true }))
    const da = liste.find((n) => n.title === KV_NAME || n.title?.endsWith(`-${KV_NAME}`))
    if (da) {
      console.log(gruen(`gefunden (${da.id})`))
      return da.id
    }
  } catch {
    // Same as above.
  }

  const ausgabe = wrangler(['kv', 'namespace', 'create', KV_NAME], { leise: true })
  const id = findeId(ausgabe, 'id')
  if (!id) throw new Error(`Konnte die KV-id nicht aus der Ausgabe lesen:\n${ausgabe}`)
  console.log(gruen(`angelegt (${id})`))
  return id
}

function eintragen(d1Id, kvId) {
  let toml = readFileSync(KONFIG, 'utf8')

  // Replace the placeholder, or an id that is already there — both work, so
  // pointing the app at a different database is one run of this script.
  toml = toml.replace(
    /(\[\[d1_databases\]\][\s\S]*?database_id\s*=\s*)"[^"]*"/,
    `$1"${d1Id}"`,
  )
  toml = toml.replace(/(\[\[kv_namespaces\]\][\s\S]*?\bid\s*=\s*)"[^"]*"/, `$1"${kvId}"`)

  writeFileSync(KONFIG, toml)
  console.log(gruen(`\n${KONFIG} aktualisiert.`))
}

try {
  console.log('Richtet D1 und KV für quitt ein.\n')

  const d1Id = d1Anlegen()
  const kvId = kvAnlegen()
  eintragen(d1Id, kvId)

  console.log(grau('\nJetzt noch die Migration fahren:'))
  console.log('  npm run db:remote\n')
  console.log(grau('Danach die geänderte wrangler.toml committen und pushen.'))
} catch (e) {
  console.error(rot('\nDas hat nicht geklappt:\n'))
  console.error(e.message)
  console.error(gelb('\nFalls du noch nicht angemeldet bist:'))
  console.error('  npx wrangler login\n')
  process.exit(1)
}
