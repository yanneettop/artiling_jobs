import { authenticate, unauthorized } from '../../_shared/auth.js'
import { json } from '../../_shared/repository.js'

// File storage for quotes, drawings and site photos, kept in R2. Only a
// signed-in human can upload, read or remove a file; bots have no access to
// documents at all, which matches the records API.
const MAX_BYTES = 25 * 1024 * 1024

// Deliberately excludes SVG and HTML: they can carry script, and the app is
// served from this same origin behind Cloudflare Access.
const EXTENSION_BY_TYPE = new Map([
  ['application/pdf', 'pdf'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['image/heic', 'heic'],
  ['image/tiff', 'tiff'],
  ['text/plain', 'txt'],
  ['text/csv', 'csv'],
  ['application/zip', 'zip'],
  ['application/msword', 'doc'],
  ['application/vnd.ms-excel', 'xls'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx'],
])

const TYPE_BY_EXTENSION = new Map([...EXTENSION_BY_TYPE].map(([type, extension]) => [extension, type]))

// Only these render in the browser. Everything else downloads, so an uploaded
// file can never execute in the application's origin.
const INLINE_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const UNSAFE_NAME_CHARACTERS = ['"', "'", '\\', '/']

function pathOf(params) {
  return (Array.isArray(params.path) ? params.path : [params.path]).filter(Boolean).join('/')
}

function extensionOf(name) {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(String(name || ''))
  return match ? match[1].toLowerCase() : ''
}

function resolveType(file) {
  const declared = String(file.type || '').split(';')[0].trim().toLowerCase()
  if (EXTENSION_BY_TYPE.has(declared)) return declared
  // Browsers leave the type empty for some files; fall back to the extension.
  return TYPE_BY_EXTENSION.get(extensionOf(file.name)) || ''
}

// Keeps a readable name for the download without trusting it as a path.
// Control characters and quotes are dropped so the name cannot break out of
// the Content-Disposition header.
function safeName(name, extension) {
  const cleaned = [...String(name || '')]
    .filter((character) => character >= ' ' && !UNSAFE_NAME_CHARACTERS.includes(character))
    .join('')
    .trim()
    .slice(0, 120)
  return cleaned || `document.${extension}`
}

function storageUnavailable() {
  return json({
    error: 'File storage is not configured. Create an R2 bucket and bind it to this Pages project as DOCUMENTS.',
  }, 503)
}

// The three operations are exported on their own so the validation and storage
// rules can be tested without a Cloudflare Access token.
export async function uploadDocument(request, env, actor) {
  if (!env.DOCUMENTS) return storageUnavailable()

  let form
  try { form = await request.formData() } catch { return json({ error: 'Send the file as multipart/form-data' }, 400) }
  const file = form.get('file')
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    return json({ error: 'Attach the file in a "file" field' }, 400)
  }
  if (file.size === 0) return json({ error: 'The file is empty' }, 400)
  if (file.size > MAX_BYTES) return json({ error: `Files must be ${MAX_BYTES / 1024 / 1024}MB or smaller` }, 413)

  const contentType = resolveType(file)
  if (!contentType) {
    return json({ error: `That file type is not accepted. Allowed: ${[...TYPE_BY_EXTENSION.keys()].join(', ')}` }, 415)
  }

  // The key is generated here, so a client-supplied name never becomes a path.
  const extension = EXTENSION_BY_TYPE.get(contentType)
  const key = `documents/${crypto.randomUUID()}.${extension}`
  const fileName = safeName(file.name, extension)

  await env.DOCUMENTS.put(key, file.stream(), {
    httpMetadata: { contentType },
    customMetadata: { file_name: fileName, uploaded_by: actor.name, uploaded_at: new Date().toISOString() },
  })

  return json({
    key,
    file_url: `/api/files/${key}`,
    file_name: fileName,
    mime_type: contentType,
    size: file.size,
  }, 201)
}

export async function downloadDocument(env, key) {
  if (!env.DOCUMENTS) return storageUnavailable()
  if (!key.startsWith('documents/')) return json({ error: 'Not found' }, 404)
  const object = await env.DOCUMENTS.get(key)
  if (!object) return json({ error: 'File not found' }, 404)

  const contentType = object.httpMetadata?.contentType || 'application/octet-stream'
  const fileName = object.customMetadata?.file_name || key.split('/').pop()
  const disposition = INLINE_TYPES.has(contentType) ? 'inline' : 'attachment'

  return new Response(object.body, {
    headers: {
      'content-type': contentType,
      'content-length': String(object.size),
      'content-disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
      'cache-control': 'private, max-age=300',
    },
  })
}

export async function deleteDocument(env, key) {
  if (!env.DOCUMENTS) return storageUnavailable()
  if (!key.startsWith('documents/')) return json({ error: 'Not found' }, 404)
  await env.DOCUMENTS.delete(key)
  return json({ deleted: key })
}

// Every route is restricted to a signed-in human.
async function requireHuman(request, env, action) {
  const actor = await authenticate(request, env)
  if (!actor) return { response: unauthorized(request) }
  if (actor.type !== 'human') return { response: json({ error: `Only a signed-in user can ${action} files` }, 403) }
  return { actor }
}

export async function onRequestPost({ request, env, params }) {
  const { actor, response } = await requireHuman(request, env, 'upload')
  if (response) return response
  if (pathOf(params)) return json({ error: 'Not found' }, 404)
  return uploadDocument(request, env, actor)
}

export async function onRequestGet({ request, env, params }) {
  const { response } = await requireHuman(request, env, 'read')
  if (response) return response
  return downloadDocument(env, pathOf(params))
}

export async function onRequestDelete({ request, env, params }) {
  const { response } = await requireHuman(request, env, 'remove')
  if (response) return response
  return deleteDocument(env, pathOf(params))
}
