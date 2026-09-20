const encoder = new TextEncoder()
const decoder = new TextDecoder()

// Registered client ids carry their own redirect allow-list, signed, so dynamic
// client registration needs no extra storage or database migration.
const REGISTERED_CLIENT_PREFIX = 'dcr_'

function base64UrlEncode(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))
}

function equalBytes(left, right) {
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) mismatch |= left[index] ^ right[index]
  return mismatch === 0
}

async function verifySignedPayload(secret, payload, signature) {
  if (!secret || !payload || !signature) return null
  try {
    if (!equalBytes(await hmac(secret, payload), base64UrlDecode(signature))) return null
    return JSON.parse(decoder.decode(base64UrlDecode(payload)))
  } catch {
    return null
  }
}

// The authorization code and registered client ids are signed with this key. It
// falls back to the bot token so the OAuth flow keeps working when only the
// static client credentials are missing.
export function oauthSigningKey(env) {
  return env.GROK_OAUTH_CLIENT_SECRET || env.BOT_API_TOKEN || ''
}

export async function createAuthorizationCode(secret, claims) {
  const payload = base64UrlEncode(encoder.encode(JSON.stringify(claims)))
  const signature = base64UrlEncode(await hmac(secret, payload))
  return `${payload}.${signature}`
}

export async function verifyAuthorizationCode(secret, code) {
  const [payload, signature, extra] = String(code || '').split('.')
  if (extra !== undefined) return null
  const claims = await verifySignedPayload(secret, payload, signature)
  if (!claims || !Number.isFinite(claims.exp) || claims.exp < Math.floor(Date.now() / 1000)) return null
  return claims
}

export async function createRegisteredClientId(secret, redirectUris) {
  const payload = base64UrlEncode(encoder.encode(JSON.stringify({
    redirect_uris: redirectUris,
    iat: Math.floor(Date.now() / 1000),
  })))
  const signature = base64UrlEncode(await hmac(secret, payload))
  return `${REGISTERED_CLIENT_PREFIX}${payload}.${signature}`
}

export async function verifyRegisteredClientId(secret, clientId) {
  const value = String(clientId || '')
  if (!value.startsWith(REGISTERED_CLIENT_PREFIX)) return null
  const [payload, signature, extra] = value.slice(REGISTERED_CLIENT_PREFIX.length).split('.')
  if (extra !== undefined) return null
  const claims = await verifySignedPayload(secret, payload, signature)
  if (!claims || !Array.isArray(claims.redirect_uris) || claims.redirect_uris.length === 0) return null
  return claims
}

export async function verifyPkce(verifier, challenge) {
  if (!verifier || !challenge) return false
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier)))
  return base64UrlEncode(digest) === challenge
}

export function isAllowedRedirectUri(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (url.hostname === 'grok.com' || url.hostname.endsWith('.grok.com'))
  } catch {
    return false
  }
}
