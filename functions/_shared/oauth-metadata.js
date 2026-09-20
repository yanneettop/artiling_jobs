// OAuth discovery documents, shared by the routes that publish them.
//
// Cloudflare Access guards the whole site except /mcp* and /oauth/token, so the
// documents and the registration endpoint are published under /mcp/ where a
// client can actually read them without a browser login. The authorization
// endpoint stays behind Access on purpose: that is the human login step.
//
// The issuer is therefore the resource itself, https://<host>/mcp, and the
// metadata lives at the two locations a compliant client looks for an issuer
// that has a path: <origin>/mcp/.well-known/... and
// <origin>/.well-known/.../mcp.
export const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization, mcp-protocol-version',
}

export function issuerFor(origin) {
  return `${origin}/mcp`
}

export function authorizationServerMetadata(origin) {
  return {
    issuer: issuerFor(origin),
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/mcp/register`,
    scopes_supported: ['mcp'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
  }
}

export function protectedResourceMetadata(origin) {
  return {
    resource: `${origin}/mcp`,
    authorization_servers: [issuerFor(origin)],
    scopes_supported: ['mcp'],
    bearer_methods_supported: ['header'],
  }
}

export function metadataResponse(value) {
  return Response.json(value, {
    headers: { ...CORS, 'cache-control': 'public, max-age=3600' },
  })
}

export function notFound() {
  return Response.json({ error: 'not_found' }, { status: 404, headers: CORS })
}

export function preflight() {
  return new Response(null, { status: 204, headers: CORS })
}
