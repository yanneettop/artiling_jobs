import { createRemoteJWKSet, jwtVerify } from 'jose'

const encoder = new TextEncoder()
const jwksByDomain = new Map()

async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return new Uint8Array(bytes)
}

function equalBytes(left, right) {
  if (left.length !== right.length) return false
  let result = 0
  for (let index = 0; index < left.length; index += 1) result |= left[index] ^ right[index]
  return result === 0
}

export async function authenticate(request, env) {
  const authorization = request.headers.get('authorization') || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (token && env.BOT_API_TOKEN) {
    const [actual, expected] = await Promise.all([digest(token), digest(env.BOT_API_TOKEN)])
    if (equalBytes(actual, expected)) {
      return { name: env.BOT_ACTOR_NAME || 'grok-bot', type: 'bot' }
    }
  }

  const accessJwt = request.headers.get('cf-access-jwt-assertion')
  if (accessJwt && env.TEAM_DOMAIN && env.POLICY_AUD) {
    try {
      const domain = String(env.TEAM_DOMAIN).replace(/\/$/, '')
      let jwks = jwksByDomain.get(domain)
      if (!jwks) {
        jwks = createRemoteJWKSet(new URL(`${domain}/cdn-cgi/access/certs`))
        jwksByDomain.set(domain, jwks)
      }
      const { payload } = await jwtVerify(accessJwt, jwks, {
        issuer: domain,
        audience: env.POLICY_AUD,
      })
      if (typeof payload.email === 'string') return { name: payload.email, type: 'human' }
    } catch {
      return null
    }
  }

  return null
}

// RFC 9728: point unauthenticated clients at the discovery document so they can
// find the authorization server and register themselves.
export function unauthorized(request) {
  let challenge = 'Bearer realm="Artiling Jobs MCP"'
  try {
    const { origin } = new URL(request.url)
    // The copy under /mcp/ is the one reachable without a Cloudflare Access login.
    challenge += `, resource_metadata="${origin}/mcp/.well-known/oauth-protected-resource"`
  } catch {
    // Fall back to the bare challenge when no request URL is available.
  }
  return Response.json({ error: 'Authentication required' }, {
    status: 401,
    headers: { 'www-authenticate': challenge },
  })
}
