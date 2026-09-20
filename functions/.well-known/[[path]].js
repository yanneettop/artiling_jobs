// OAuth discovery documents (RFC 8414 and RFC 9728). MCP clients read these to
// find the endpoints and to register themselves, so a connector can be added
// from the server URL alone with no hand-entered credentials.
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization, mcp-protocol-version',
}

function metadata(value) {
  return Response.json(value, {
    headers: { ...CORS, 'cache-control': 'public, max-age=3600' },
  })
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS })
}

export function onRequestGet({ request, params }) {
  const { origin } = new URL(request.url)
  const segments = (Array.isArray(params.path) ? params.path : [params.path]).filter(Boolean)
  const document = segments[0] || ''

  if (document === 'oauth-authorization-server') {
    return metadata({
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      registration_endpoint: `${origin}/oauth/register`,
      scopes_supported: ['mcp'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    })
  }

  if (document === 'oauth-protected-resource') {
    return metadata({
      resource: `${origin}/mcp`,
      authorization_servers: [origin],
      scopes_supported: ['mcp'],
      bearer_methods_supported: ['header'],
      resource_documentation: `${origin}/mcp`,
    })
  }

  return Response.json({ error: 'not_found' }, { status: 404, headers: CORS })
}
