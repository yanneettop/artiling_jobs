import test from 'node:test'
import assert from 'node:assert/strict'
import {
  deleteDocument,
  downloadDocument,
  onRequestGet,
  onRequestPost,
  uploadDocument,
} from '../functions/api/files/[[path]].js'

// Stand-in for the R2 bucket binding.
function fakeBucket() {
  const objects = new Map()
  return {
    objects,
    async put(key, body, options) {
      const chunks = []
      for await (const chunk of body) chunks.push(chunk)
      const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
      objects.set(key, { body: bytes, size: bytes.length, ...options })
    },
    async get(key) {
      return objects.get(key) || null
    },
    async delete(key) {
      objects.delete(key)
    },
  }
}

const actor = { name: 'ioannis@example.com', type: 'human' }

function uploadRequest(file) {
  const form = new FormData()
  if (file) form.append('file', file)
  return new Request('https://example.test/api/files', { method: 'POST', body: form })
}

const pdf = (name = 'quote.pdf') => new File([new Uint8Array([37, 80, 68, 70])], name, { type: 'application/pdf' })

test('uploading a PDF stores it under a generated key', async () => {
  const env = { DOCUMENTS: fakeBucket() }
  const response = await uploadDocument(uploadRequest(pdf('AS-GERRARD-LDN-01.pdf')), env, actor)
  const body = await response.json()
  assert.equal(response.status, 201)
  assert.match(body.key, /^documents\/[0-9a-f-]{36}\.pdf$/)
  assert.equal(body.file_url, `/api/files/${body.key}`)
  assert.equal(body.file_name, 'AS-GERRARD-LDN-01.pdf')
  assert.equal(body.mime_type, 'application/pdf')
  assert.equal(env.DOCUMENTS.objects.get(body.key).customMetadata.uploaded_by, actor.name)
})

test('the stored key never comes from the supplied file name', async () => {
  const env = { DOCUMENTS: fakeBucket() }
  const response = await uploadDocument(uploadRequest(pdf('../../etc/passwd.pdf')), env, actor)
  const body = await response.json()
  assert.match(body.key, /^documents\/[0-9a-f-]{36}\.pdf$/)
  assert.ok(!body.key.includes('..'))
  assert.ok(!body.file_name.includes('/'))
})

test('a file type that can carry script is refused', async () => {
  const env = { DOCUMENTS: fakeBucket() }
  for (const [name, type] of [['x.svg', 'image/svg+xml'], ['x.html', 'text/html'], ['x.exe', 'application/x-msdownload']]) {
    const response = await uploadDocument(uploadRequest(new File([new Uint8Array([1])], name, { type })), env, actor)
    assert.equal(response.status, 415, name)
  }
  assert.equal(env.DOCUMENTS.objects.size, 0)
})

test('an empty or oversized file is refused', async () => {
  const env = { DOCUMENTS: fakeBucket() }
  const empty = await uploadDocument(uploadRequest(new File([], 'empty.pdf', { type: 'application/pdf' })), env, actor)
  assert.equal(empty.status, 400)
  const big = new File([new Uint8Array(26 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' })
  const oversized = await uploadDocument(uploadRequest(big), env, actor)
  assert.equal(oversized.status, 413)
  assert.equal(env.DOCUMENTS.objects.size, 0)
})

test('a missing file field is refused', async () => {
  const env = { DOCUMENTS: fakeBucket() }
  const response = await uploadDocument(uploadRequest(null), env, actor)
  assert.equal(response.status, 400)
})

test('an unconfigured bucket explains what to do', async () => {
  const response = await uploadDocument(uploadRequest(pdf()), {}, actor)
  assert.equal(response.status, 503)
  assert.match((await response.json()).error, /R2 bucket/)
})

test('downloading returns the bytes with hardening headers', async () => {
  const env = { DOCUMENTS: fakeBucket() }
  const { key } = await (await uploadDocument(uploadRequest(pdf('Quote 1.pdf')), env, actor)).json()
  const response = await downloadDocument(env, key)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/pdf')
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.match(response.headers.get('content-security-policy'), /sandbox/)
  assert.match(response.headers.get('content-disposition'), /^inline; filename\*=UTF-8''Quote%201\.pdf$/)
  assert.equal(Buffer.from(await response.arrayBuffer()).toString(), '%PDF')
})

test('a type the browser should not render is sent as a download', async () => {
  const env = { DOCUMENTS: fakeBucket() }
  const zip = new File([new Uint8Array([80, 75])], 'photos.zip', { type: 'application/zip' })
  const { key } = await (await uploadDocument(uploadRequest(zip), env, actor)).json()
  const response = await downloadDocument(env, key)
  assert.match(response.headers.get('content-disposition'), /^attachment;/)
})

test('an inline file can be explicitly downloaded', async () => {
  const env = { DOCUMENTS: fakeBucket() }
  const { key } = await (await uploadDocument(uploadRequest(pdf('Client quote.pdf')), env, actor)).json()
  const response = await downloadDocument(env, key, true)
  assert.match(response.headers.get('content-disposition'), /^attachment; filename\*=UTF-8''Client%20quote\.pdf$/)
})

test('reading outside the documents prefix is refused', async () => {
  const env = { DOCUMENTS: fakeBucket() }
  env.DOCUMENTS.objects.set('secrets/key.txt', { body: Buffer.from('x'), size: 1 })
  assert.equal((await downloadDocument(env, 'secrets/key.txt')).status, 404)
  assert.equal((await downloadDocument(env, 'documents/missing.pdf')).status, 404)
  assert.equal((await deleteDocument(env, 'secrets/key.txt')).status, 404)
  assert.equal(env.DOCUMENTS.objects.size, 1)
})

test('deleting removes the object', async () => {
  const env = { DOCUMENTS: fakeBucket() }
  const { key } = await (await uploadDocument(uploadRequest(pdf()), env, actor)).json()
  assert.equal((await deleteDocument(env, key)).status, 200)
  assert.equal(env.DOCUMENTS.objects.size, 0)
})

test('routes refuse anyone who is not a signed-in human', async () => {
  const env = { DOCUMENTS: fakeBucket(), BOT_API_TOKEN: 'bot-token' }
  const anonymous = await onRequestPost({ request: uploadRequest(pdf()), env, params: { path: [] } })
  assert.equal(anonymous.status, 401)

  const botForm = new FormData()
  botForm.append('file', pdf())
  const asBot = await onRequestPost({
    request: new Request('https://example.test/api/files', {
      method: 'POST', headers: { authorization: 'Bearer bot-token' }, body: botForm,
    }),
    env,
    params: { path: [] },
  })
  assert.equal(asBot.status, 403)

  const botRead = await onRequestGet({
    request: new Request('https://example.test/api/files/documents/x.pdf', { headers: { authorization: 'Bearer bot-token' } }),
    env,
    params: { path: ['documents', 'x.pdf'] },
  })
  assert.equal(botRead.status, 403)
  assert.equal(env.DOCUMENTS.objects.size, 0)
})
