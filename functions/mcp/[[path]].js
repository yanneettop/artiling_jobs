import { onRequestGet as mcpGet, onRequestPost as mcpPost } from '../mcp.js'
import {
  authorizationServerMetadata,
  metadataResponse,
  notFound,
  preflight,
  protectedResourceMetadata,
} from '../_shared/oauth-metadata.js'
import { registerClient } from '../_shared/register-client.js'

// Everything under /mcp/ is reachable without a Cloudflare Access login, so the
// OAuth discovery documents and the registration endpoint are published here.
//
// This catch-all also matches /mcp itself and takes precedence over mcp.js, so
// the bare path is handed back to the MCP handler.
const ROUTES = {
  '.well-known/oauth-authorization-server': authorizationServerMetadata,
  '.well-known/oauth-protected-resource': protectedResourceMetadata,
}

function routeOf(params) {
  return (Array.isArray(params.path) ? params.path : [params.path]).filter(Boolean).join('/')
}

export function onRequestOptions() {
  return preflight()
}

export function onRequestGet(context) {
  const route = routeOf(context.params)
  if (!route) return mcpGet(context)
  const build = ROUTES[route]
  if (!build) return notFound()
  return metadataResponse(build(new URL(context.request.url).origin))
}

export async function onRequestPost(context) {
  const route = routeOf(context.params)
  if (!route) return mcpPost(context)
  if (route !== 'register') return notFound()
  return registerClient(context.request, context.env)
}
