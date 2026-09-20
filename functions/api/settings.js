import { authenticate, unauthorized } from '../_shared/auth.js'
import { json } from '../_shared/repository.js'

export async function onRequestPut({ request, env }) {
  const actor = await authenticate(request, env)
  if (!actor) return unauthorized(request)
  if (actor.type !== 'human') return json({ error: 'Bots cannot change application settings' }, 403)
  const settings = await request.json()
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return json({ error: 'Invalid settings' }, 400)
  const now = new Date().toISOString()
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO app_settings (id, data, version, updated_at) VALUES ('main', ?1, 1, ?2)
      ON CONFLICT(id) DO UPDATE SET data = excluded.data, version = app_settings.version + 1, updated_at = excluded.updated_at
    `).bind(JSON.stringify(settings), now),
    env.DB.prepare(`
      INSERT INTO activity_log
        (id, actor, actor_type, action, collection, record_id, old_value_json, new_value_json, created_at)
      VALUES (?1, ?2, 'human', 'SETTINGS_UPDATED', 'settings', 'main', NULL, ?3, ?4)
    `).bind(crypto.randomUUID(), actor.name, JSON.stringify(settings), now),
  ])
  return json({ ok: true })
}
