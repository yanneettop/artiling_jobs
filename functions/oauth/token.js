import { verifyAuthorizationCode, verifyPkce } from '../_shared/oauth.js'

function error(error, description, status = 400) {
  return Response.json({ error, error_description: description }, {
    status,
    headers: { 'cache-control': 'no-store' },
  })
}

export async function onRequestPost({ request, env }) {
  const contentType = request.headers.get('content-type') || ''
  const params = contentType.includes('application/json')
    ? new URLSearchParams(await request.json())
    : new URLSearchParams(await request.text())

  const clientId = params.get('client_id') || ''
  const clientSecret = params.get('client_secret') || ''
  if (clientId !== env.GROK_OAUTH_CLIENT_ID || clientSecret !== env.GROK_OAUTH_CLIENT_SECRET) {
    return error('invalid_client', 'Invalid client credentials', 401)
  }
  if (params.get('grant_type') !== 'authorization_code') return error('unsupported_grant_type', 'Only authorization_code is supported')

  const claims = await verifyAuthorizationCode(env.GROK_OAUTH_CLIENT_SECRET, params.get('code'))
  if (!claims || claims.clientId !== clientId || claims.redirectUri !== params.get('redirect_uri')) {
    return error('invalid_grant', 'Invalid or expired authorization code')
  }
  if (!await verifyPkce(params.get('code_verifier'), claims.challenge)) return error('invalid_grant', 'PKCE verification failed')

  return Response.json({
    access_token: env.BOT_API_TOKEN,
    token_type: 'Bearer',
    expires_in: 31536000,
    scope: 'mcp',
  }, { headers: { 'cache-control': 'no-store', pragma: 'no-cache' } })
}
