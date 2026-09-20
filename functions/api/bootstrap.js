import { authenticate, unauthorized } from '../_shared/auth.js'
import { COLLECTIONS, json } from '../_shared/repository.js'

export async function onRequestPost({ request, env }) {
  const actor = await authenticate(request, env)
  if (!actor) return unauthorized(request)
  if (actor.type !== 'human') return json({ error: 'Only a human administrator can bootstrap data' }, 403)

  const existing = await env.DB.prepare('SELECT COUNT(*) AS count FROM records').first()
  if (Number(existing.count) > 0) return json({ error: 'Database is already initialized' }, 409)

  const database = await request.json()
  const now = new Date().toISOString()
  const statements = []
  for (const collection of COLLECTIONS) {
    const values = Array.isArray(database[collection]) ? database[collection] : []
    for (const value of values) {
      if (!value || typeof value.id !== 'string') return json({ error: `Invalid ${collection} record` }, 400)
      statements.push(env.DB.prepare(`
        INSERT INTO records (collection, id, data, version, created_at, updated_at)
        VALUES (?1, ?2, ?3, 1, ?4, ?4)
      `).bind(collection, value.id, JSON.stringify(value), now))
    }
  }
  statements.push(env.DB.prepare(`
    INSERT INTO app_settings (id, data, version, updated_at) VALUES ('main', ?1, 1, ?2)
  `).bind(JSON.stringify(database.settings || {}), now))
  statements.push(env.DB.prepare(`
    INSERT INTO activity_log
      (id, actor, actor_type, action, collection, record_id, old_value_json, new_value_json, created_at)
    VALUES (?1, ?2, 'human', 'DATABASE_BOOTSTRAPPED', NULL, NULL, NULL, ?3, ?4)
  `).bind(crypto.randomUUID(), actor.name, JSON.stringify({ records: statements.length - 1 }), now))

  await env.DB.batch(statements)
  return json({ ok: true, records: statements.length - 2 }, 201)
}
