import {
  oauthSigningKey,
  verifyAuthorizationCode,
  verifyPkce,
  verifyRegisteredClientId,
} from '../_shared/oauth.js'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization',
}

function error(error, description, status = 400) {
  return Response.json({ error, error_description: description }, {
    status,
    headers: { ...CORS, 'cache-control': 'no-store' },
  })
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS })
}

export async function onRequestPost({ request, env }) {
  const contentType = request.headers.get('content-type') || ''
  const params = contentType.includes('application/json')
    ? new URLSearchParams(await request.json())
    : new URLSearchParams(await request.text())

  const signingKey = oauthSigningKey(env)
  if (!signingKey) return error('server_error', 'Server is not configured for OAuth', 500)

  const clientId = params.get('client_id') || ''
  const clientSecret = params.get('client_secret') || ''

  // The statically configured client authenticates with its secret. Clients
  // issued by /oauth/register are public and rely on PKCE, verified below.
  const isStaticClient = Boolean(env.GROK_OAUTH_CLIENT_ID) && clientId === env.GROK_OAUTH_CLIENT_ID
  if (isStaticClient) {
    if (clientSecret !== env.GROK_OAUTH_CLIENT_SECRET) return error('invalid_client', 'Invalid client credentials', 401)
  } else if (!await verifyRegisteredClientId(signingKey, clientId)) {
    return error('invalid_client', 'Invalid client credentials', 401)
  }

  if (params.get('grant_type') !== 'authorization_code') return error('unsupported_grant_type', 'Only authorization_code is supported')

  const claims = await verifyAuthorizationCode(signingKey, params.get('code'))
  if (!claims || claims.clientId !== clientId || claims.redirectUri !== params.get('redirect_uri')) {
    return error('invalid_grant', 'Invalid or expired authorization code')
  }
  if (!await verifyPkce(params.get('code_verifier'), claims.challenge)) return error('invalid_grant', 'PKCE verification failed')

  return Response.json({
    access_token: env.BOT_API_TOKEN,
    token_type: 'Bearer',
    expires_in: 31536000,
    scope: 'mcp',
  }, { headers: { ...CORS, 'cache-control': 'no-store', pragma: 'no-cache' } })
}
