import { authenticate, unauthorized } from '../../../_shared/auth.js'
import {
  BOT_WRITABLE_COLLECTIONS,
  deleteRecord,
  isCollection,
  json,
  readRecord,
  writeRecord,
} from '../../../_shared/repository.js'

export async function onRequestGet({ request, env, params }) {
  const actor = await authenticate(request, env)
  if (!actor) return unauthorized(request)
  if (!isCollection(params.collection)) return json({ error: 'Unknown collection' }, 404)
  const record = await readRecord(env.DB, params.collection, params.id)
  return record ? json(record) : json({ error: 'Record not found' }, 404)
}

export async function onRequestPut({ request, env, params }) {
  const actor = await authenticate(request, env)
  if (!actor) return unauthorized(request)
  if (!isCollection(params.collection)) return json({ error: 'Unknown collection' }, 404)
  if (actor.type === 'bot' && !BOT_WRITABLE_COLLECTIONS.has(params.collection)) {
    return json({ error: 'Bots cannot write this collection' }, 403)
  }

  const body = await request.json()
  if (!body || typeof body !== 'object' || body.id !== params.id) {
    return json({ error: 'Body id must match the URL id' }, 400)
  }
  const expected = request.headers.get('if-match')
  const result = await writeRecord(env.DB, actor, params.collection, body, expected)
  return result.conflict ? json({ error: 'Version conflict', current: result.current }, 409) : json(result)
}

export async function onRequestDelete({ request, env, params }) {
  const actor = await authenticate(request, env)
  if (!actor) return unauthorized(request)
  if (actor.type !== 'human') return json({ error: 'Only a signed-in user can delete records' }, 403)
  if (!isCollection(params.collection)) return json({ error: 'Unknown collection' }, 404)
  if (params.collection !== 'documents') return json({ error: 'Deletion is disabled. Archive the record instead.' }, 405)
  const deleted = await deleteRecord(env.DB, actor, params.collection, params.id)
  return deleted ? json({ deleted: params.id }) : json({ error: 'Record not found' }, 404)
}
