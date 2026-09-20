import { preflight } from '../_shared/oauth-metadata.js'
import { registerClient } from '../_shared/register-client.js'

// Kept as the conventional location. Cloudflare Access guards /oauth/register,
// so the discovery documents advertise /mcp/register instead.
export function onRequestOptions() {
  return preflight()
}

export async function onRequestPost({ request, env }) {
  return registerClient(request, env)
}
