import { createRegisteredClientId, isAllowedRedirectUri, oauthSigningKey } from './oauth.js'
import { CORS } from './oauth-metadata.js'

// RFC 7591 dynamic client registration. Registration is open, which is what
// lets an MCP client connect from the server URL alone, but it only ever issues
// public PKCE clients whose redirect URIs are already on the grok.com
// allow-list. It grants nothing by itself: /oauth/authorize still refuses to
// issue an authorization code without a Cloudflare Access login.
function error(code, description, status = 400) {
  return Response.json({ error: code, error_description: description }, {
    status,
    headers: { ...CORS, 'cache-control': 'no-store' },
  })
}

export async function registerClient(request, env) {
  const signingKey = oauthSigningKey(env)
  if (!signingKey) return error('server_error', 'Server is not configured for OAuth', 500)

  let body
  try { body = await request.json() } catch { return error('invalid_client_metadata', 'Body must be JSON') }
  if (!body || typeof body !== 'object') return error('invalid_client_metadata', 'Body must be a JSON object')

  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : []
  if (redirectUris.length === 0) return error('invalid_redirect_uri', 'redirect_uris is required')
  if (redirectUris.length > 10) return error('invalid_redirect_uri', 'Too many redirect URIs')
  if (!redirectUris.every((uri) => typeof uri === 'string' && isAllowedRedirectUri(uri))) {
    return error('invalid_redirect_uri', 'Redirect URIs must be https URLs on grok.com')
  }

  const grantTypes = Array.isArray(body.grant_types) ? body.grant_types : ['authorization_code']
  if (!grantTypes.every((grant) => grant === 'authorization_code')) {
    return error('invalid_client_metadata', 'Only the authorization_code grant is supported')
  }

  const clientId = await createRegisteredClientId(signingKey, redirectUris)
  return Response.json({
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: typeof body.client_name === 'string' ? body.client_name.slice(0, 120) : 'MCP client',
    redirect_uris: redirectUris,
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    scope: 'mcp',
  }, { status: 201, headers: { ...CORS, 'cache-control': 'no-store' } })
}
