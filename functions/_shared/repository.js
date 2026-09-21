export const COLLECTIONS = [
  'clients', 'leads', 'specifications', 'quotes', 'quoteItems', 'jobs',
  'tasks', 'events', 'payments', 'materials', 'documents', 'notes', 'activities',
]

export const BOT_WRITABLE_COLLECTIONS = new Set(['clients', 'leads', 'tasks', 'notes'])

export function isCollection(value) {
  return COLLECTIONS.includes(value)
}

export function json(value, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  })
}

export async function readRecord(db, collection, id) {
  const row = await db.prepare(
    'SELECT data, version FROM records WHERE collection = ?1 AND id = ?2',
  ).bind(collection, id).first()
  return row ? { value: JSON.parse(row.data), version: row.version } : null
}

export async function listRecords(db, collection) {
  const result = await db.prepare(
    'SELECT data FROM records WHERE collection = ?1 ORDER BY created_at ASC',
  ).bind(collection).all()
  return result.results.map((row) => JSON.parse(row.data))
}

export async function writeRecord(db, actor, collection, value, expectedVersion = null) {
  const now = new Date().toISOString()
  const current = await readRecord(db, collection, value.id)
  if (expectedVersion !== null && current && Number(expectedVersion) !== Number(current.version)) {
    return { conflict: true, current }
  }

  const next = { ...value, updated_at: now }
  if (!current && 'created_at' in next && !next.created_at) next.created_at = now
  const nextVersion = current ? Number(current.version) + 1 : 1
  const activityId = crypto.randomUUID()
  const statements = [
    db.prepare(`
      INSERT INTO records (collection, id, data, version, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?5)
      ON CONFLICT(collection, id) DO UPDATE SET
        data = excluded.data, version = excluded.version, updated_at = excluded.updated_at
    `).bind(collection, next.id, JSON.stringify(next), nextVersion, current ? now : (next.created_at || now)),
    db.prepare(`
      INSERT INTO activity_log
        (id, actor, actor_type, action, collection, record_id, old_value_json, new_value_json, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    `).bind(
      activityId,
      actor.name,
      actor.type,
      current ? 'UPDATED' : 'CREATED',
      collection,
      next.id,
      current ? JSON.stringify(current.value) : null,
      JSON.stringify(next),
      now,
    ),
  ]
  await db.batch(statements)
  return { value: next, version: nextVersion }
}

export async function deleteRecord(db, actor, collection, id) {
  const current = await readRecord(db, collection, id)
  if (!current) return null

  const now = new Date().toISOString()
  await db.batch([
    db.prepare('DELETE FROM records WHERE collection = ?1 AND id = ?2').bind(collection, id),
    db.prepare(`
      INSERT INTO activity_log
        (id, actor, actor_type, action, collection, record_id, old_value_json, new_value_json, created_at)
      VALUES (?1, ?2, ?3, 'DELETED', ?4, ?5, ?6, NULL, ?7)
    `).bind(crypto.randomUUID(), actor.name, actor.type, collection, id, JSON.stringify(current.value), now),
  ])
  return current.value
}

export async function readState(db) {
  const state = Object.fromEntries(COLLECTIONS.map((collection) => [collection, []]))
  const rows = await db.prepare('SELECT collection, data FROM records ORDER BY created_at ASC').all()
  for (const row of rows.results) {
    if (isCollection(row.collection)) state[row.collection].push(JSON.parse(row.data))
  }
  const settingsRow = await db.prepare("SELECT data FROM app_settings WHERE id = 'main'").first()
  state.settings = settingsRow ? JSON.parse(settingsRow.data) : {
    company_name: 'Artiling Studio',
    email: '',
    phone: '',
    address: 'London, United Kingdom',
    quote_valid_days: 30,
    default_payment_terms: '30% deposit, balance before installation',
  }
  return { initialized: rows.results.length > 0, state }
}
