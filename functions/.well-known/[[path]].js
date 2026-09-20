import {
  authorizationServerMetadata,
  metadataResponse,
  notFound,
  preflight,
  protectedResourceMetadata,
} from '../_shared/oauth-metadata.js'

// The RFC 8414 / RFC 9728 locations for an issuer that has a path. Cloudflare
// Access currently guards /.well-known, so clients are pointed at the copies
// under /mcp/ instead; these stay for correctness and for the case where the
// Access policy is opened up later.
const ROUTES = {
  'oauth-authorization-server/mcp': authorizationServerMetadata,
  'oauth-protected-resource/mcp': protectedResourceMetadata,
  'oauth-protected-resource': protectedResourceMetadata,
}

export function onRequestOptions() {
  return preflight()
}

export function onRequestGet({ request, params }) {
  const route = (Array.isArray(params.path) ? params.path : [params.path]).filter(Boolean).join('/')
  const build = ROUTES[route]
  if (!build) return notFound()
  return metadataResponse(build(new URL(request.url).origin))
}
