import { authenticate } from '../_shared/auth.js'
import { createAuthorizationCode, isAllowedRedirectUri } from '../_shared/oauth.js'

function oauthError(redirectUri, state, error, description) {
  if (!isAllowedRedirectUri(redirectUri)) return Response.json({ error, error_description: description }, { status: 400 })
  const target = new URL(redirectUri)
  target.searchParams.set('error', error)
  target.searchParams.set('error_description', description)
  if (state) target.searchParams.set('state', state)
  return Response.redirect(target.toString(), 302)
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const clientId = url.searchParams.get('client_id') || ''
  const redirectUri = url.searchParams.get('redirect_uri') || ''
  const state = url.searchParams.get('state') || ''
  const challenge = url.searchParams.get('code_challenge') || ''
  const challengeMethod = url.searchParams.get('code_challenge_method') || ''

  if (!await authenticate(request, env)) return Response.json({ error: 'Cloudflare Access authentication required' }, { status: 401 })
  if (clientId !== env.GROK_OAUTH_CLIENT_ID) return oauthError(redirectUri, state, 'unauthorized_client', 'Unknown client')
  if (!isAllowedRedirectUri(redirectUri)) return Response.json({ error: 'invalid_request', error_description: 'Invalid redirect URI' }, { status: 400 })
  if (!challenge || challengeMethod !== 'S256') return oauthError(redirectUri, state, 'invalid_request', 'PKCE S256 is required')

  const code = await createAuthorizationCode(env.GROK_OAUTH_CLIENT_SECRET, {
    clientId,
    redirectUri,
    challenge,
    exp: Math.floor(Date.now() / 1000) + 300,
    nonce: crypto.randomUUID(),
  })
  const target = new URL(redirectUri)
  target.searchParams.set('code', code)
  if (state) target.searchParams.set('state', state)
  return Response.redirect(target.toString(), 302)
}
