import { authenticate, unauthorized } from '../_shared/auth.js'
import { json, readState } from '../_shared/repository.js'

export async function onRequestGet({ request, env }) {
  const actor = await authenticate(request, env)
  if (!actor) return unauthorized(request)
  return json(await readState(env.DB))
}
