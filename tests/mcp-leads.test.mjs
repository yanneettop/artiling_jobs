import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestPost } from '../functions/mcp.js'

// Minimal in-memory stand-in for the two D1 tables the MCP touches.
function fakeDb() {
  const records = new Map()
  const activity = []
  const key = (collection, id) => `${collection}:${id}`
  const statement = (sql, params = []) => ({
    bind: (...next) => statement(sql, next),
    first: async () => {
      if (sql.includes('FROM records WHERE collection = ?1 AND id = ?2')) {
        const row = records.get(key(params[0], params[1]))
        return row ? { data: row.data, version: row.version } : null
      }
      return null
    },
    all: async () => {
      if (sql.includes('FROM records WHERE collection = ?1')) {
        return { results: [...records.entries()].filter(([k]) => k.startsWith(`${params[0]}:`)).map(([, row]) => ({ data: row.data })) }
      }
      if (sql.includes('FROM activity_log')) return { results: activity.filter((row) => row.record_id === params[0]) }
      return { results: [] }
    },
    run: () => {
      if (sql.includes('INSERT INTO records')) {
        records.set(key(params[0], params[1]), { data: params[2], version: params[3] })
      } else if (sql.includes('INSERT INTO activity_log')) {
        activity.push({ actor: params[1], action: params[3], collection: params[4], record_id: params[5] })
      }
    },
  })
  return {
    prepare: (sql) => statement(sql),
    batch: async (statements) => statements.forEach((item) => item.run()),
    activity,
    records,
  }
}

function harness() {
  const db = fakeDb()
  const env = { DB: db, BOT_API_TOKEN: 'test-token' }
  let id = 0
  const call = async (name, args = {}) => {
    const response = await onRequestPost({
      env,
      request: new Request('https://example.test/mcp', {
        method: 'POST',
        headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: args } }),
      }),
    })
    const body = await response.json()
    return { ...body.result.structuredContent, isError: Boolean(body.result.isError) }
  }
  return { db, call }
}

test('tools/list exposes the lead and client CRUD tools', async () => {
  const { db } = harness()
  const response = await onRequestPost({
    env: { DB: db, BOT_API_TOKEN: 'test-token' },
    request: new Request('https://example.test/mcp', {
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    }),
  })
  const names = (await response.json()).result.tools.map((tool) => tool.name)
  for (const expected of ['create_client', 'update_client', 'create_lead', 'update_lead', 'archive_lead', 'list_lead_enums']) {
    assert.ok(names.includes(expected), `${expected} missing`)
  }
})

test('create_lead with an inline client creates both records with defaults', async () => {
  const { call, db } = harness()
  const created = await call('create_lead', {
    client: { name: 'Ana Popescu', email: 'ana@example.com' },
    project_title: 'Ana bathroom sink',
    project_type: 'BESPOKE_PORCELAIN_SINK',
    status: 'INFO_NEEDED',
    next_action_due: '2026-10-01',
  })
  assert.equal(created.isError, false)
  assert.equal(created.lead.status, 'INFO_NEEDED')
  assert.equal(created.lead.priority, 'NORMAL')
  assert.equal(created.lead.won_at, null)
  assert.equal(created.client.name, 'Ana Popescu')
  assert.equal(created.lead.client_id, created.client_id)
  assert.equal(created.lead.client.name, 'Ana Popescu')
  assert.equal(db.activity.filter((row) => row.action === 'CREATED').length, 2)
})

test('create_lead needs exactly one of client_id or client, and rejects unknown fields', async () => {
  const { call } = harness()
  assert.match((await call('create_lead', { project_title: 'x' })).error, /client_id/)
  const client = await call('create_client', { name: 'David' })
  assert.match((await call('create_lead', { client_id: client.client_id, client: { name: 'x' }, project_title: 'x' })).error, /not both/)
  assert.match((await call('create_lead', { client_id: client.client_id, project_title: 'x', total: 5 })).error, /not permitted: total/)
  assert.match((await call('create_lead', { client_id: 'missing', project_title: 'x' })).error, /Client not found/)
})

test('create_client rejects a duplicate email but allows a shared name with a warning', async () => {
  const { call } = harness()
  const first = await call('create_client', { name: 'Matt', email: 'Matt@Example.com' })
  assert.equal(first.isError, false)
  assert.match((await call('create_client', { name: 'Other', email: 'matt@example.com' })).error, /already exists/)
  const sameName = await call('create_client', { name: 'matt' })
  assert.equal(sameName.isError, false)
  assert.equal(sameName.possible_duplicates.length, 1)
})

test('update_lead edits identity fields and can clear won_at', async () => {
  const { call } = harness()
  const { lead_id } = await call('create_lead', { client: { name: 'Jane' }, project_title: 'Old title' })
  await call('update_lead', { lead_id, status: 'WON', won_at: '2026-09-01T10:00:00Z' })
  const updated = await call('update_lead', {
    lead_id, project_title: 'Jane vanity', project_type: 'VANITY_TOP', postcode: 'N1 9AA', won_at: null, status: 'QUOTE_SENT',
  })
  assert.equal(updated.isError, false)
  assert.equal(updated.updated.project_title, 'Jane vanity')
  assert.equal(updated.updated.project_type, 'VANITY_TOP')
  assert.equal(updated.updated.won_at, null)
  assert.equal(updated.version, 3)
})

test('update_lead validates enums and dates and protects commercial fields', async () => {
  const { call } = harness()
  const { lead_id } = await call('create_lead', { client: { name: 'Kieran' }, project_title: 'Kieran wet room' })
  assert.match((await call('update_lead', { lead_id, status: 'BOGUS' })).error, /status must be one of/)
  assert.match((await call('update_lead', { lead_id, next_action_due: 'tomorrow' })).error, /ISO date/)
  assert.match((await call('update_lead', { lead_id, waiting_for: 'GROK' })).error, /waiting_for/)
  assert.match((await call('update_lead', { lead_id, project_value: 1000 })).error, /not permitted: project_value/)
  assert.match((await call('update_lead', { lead_id })).error, /No permitted changes/)
})

test('update_client corrects details and blocks a colliding email', async () => {
  const { call } = harness()
  const a = await call('create_client', { name: 'Svetlana', email: 's@example.com' })
  const b = await call('create_client', { name: 'Huma', email: 'h@example.com' })
  const updated = await call('update_client', { client_id: a.client_id, phone: '07000 000000', company: 'S Ltd' })
  assert.equal(updated.updated.phone, '07000 000000')
  assert.match((await call('update_client', { client_id: b.client_id, email: 'S@example.com' })).error, /already uses/)
  assert.match((await call('update_client', { client_id: b.client_id, name: '  ' })).error, /name is required/)
})

test('archive_lead hides from search, is reversible, and leaves other records alone', async () => {
  const { call } = harness()
  const { lead_id } = await call('create_lead', { client: { name: 'Amelia Hart' }, project_title: 'Demo' })
  assert.equal((await call('search_leads', { query: 'amelia' })).count, 1)

  const archived = await call('archive_lead', { lead_id, reason: 'Demo seed data' })
  assert.equal(archived.archived, true)
  assert.equal(archived.lead.archived_reason, 'Demo seed data')
  assert.equal((await call('search_leads', { query: 'amelia' })).count, 0)
  assert.equal((await call('search_leads', { query: 'amelia', include_archived: true })).count, 1)

  const restored = await call('archive_lead', { lead_id, archived: false })
  assert.equal(restored.lead.archived_at, null)
  assert.equal((await call('search_leads', { query: 'amelia' })).count, 1)
})

test('list_lead_enums documents the allowed values', async () => {
  const { call } = harness()
  const values = await call('list_lead_enums')
  assert.ok(values.status.includes('WAITING_FOR_SAMPLE_FEEDBACK'))
  assert.ok(values.project_type.includes('BESPOKE_PORCELAIN_SINK'))
  assert.ok(values.waiting_for.includes('NOTHING'))
})
