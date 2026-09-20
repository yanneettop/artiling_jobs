const encoder = new TextEncoder()
const decoder = new TextDecoder()

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

export async function createAuthorizationCode(secret, claims) {
  const payload = base64UrlEncode(encoder.encode(JSON.stringify(claims)))
  const signature = base64UrlEncode(await hmac(secret, payload))
  return `${payload}.${signature}`
}

export async function verifyAuthorizationCode(secret, code) {
  const [payload, signature, extra] = String(code || '').split('.')
  if (!payload || !signature || extra) return null
  const expected = await hmac(secret, payload)
  const actual = base64UrlDecode(signature)
  if (expected.length !== actual.length) return null
  let mismatch = 0
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected[index] ^ actual[index]
  if (mismatch !== 0) return null

  try {
    const claims = JSON.parse(decoder.decode(base64UrlDecode(payload)))
    if (!Number.isFinite(claims.exp) || claims.exp < Math.floor(Date.now() / 1000)) return null
    return claims
  } catch {
    return null
  }
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
