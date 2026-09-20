import { authenticate, unauthorized } from './_shared/auth.js'
import { listRecords, readRecord, writeRecord } from './_shared/repository.js'

const LEAD_STATUSES = [
  'NEW', 'INFO_NEEDED', 'DESIGN_DISCUSSION', 'READY_TO_PRICE', 'WAITING_FOR_ARTAN',
  'READY_TO_QUOTE', 'QUOTE_IN_PREPARATION', 'QUOTE_SENT', 'WAITING_FOR_CLIENT',
  'MATERIAL_SELECTION', 'SAMPLES_TO_SEND', 'SAMPLES_SENT', 'WAITING_FOR_SAMPLE_FEEDBACK',
  'SITE_VISIT_NEEDED', 'SITE_VISIT_PROPOSED', 'SITE_VISIT_BOOKED', 'TEMPLATE_REQUIRED',
  'WAITING_FOR_DEPOSIT', 'APPROVED', 'WON', 'LOST', 'DORMANT',
]

const PRIORITIES = ['HIGH', 'NORMAL', 'LOW']
const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'WAITING', 'DONE']

const tools = [
  {
    name: 'search_leads',
    description: 'Find Artiling leads by client, project text, status, or priority. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Client, company, project, postcode, or address text.' },
        status: { type: 'string', enum: LEAD_STATUSES },
        priority: { type: 'string', enum: PRIORITIES },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_lead',
    description: 'Get one lead with its client, notes, tasks, and recent activity.',
    inputSchema: {
      type: 'object',
      properties: { lead_id: { type: 'string' } },
      required: ['lead_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_lead',
    description: 'Update operational fields on a lead. Does not change prices, quotes, or payments.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string' },
        status: { type: 'string', enum: LEAD_STATUSES },
        priority: { type: 'string', enum: PRIORITIES },
        next_action: { type: 'string', maxLength: 500 },
        next_action_owner: { type: 'string', maxLength: 120 },
        next_action_due: { type: ['string', 'null'], description: 'ISO date YYYY-MM-DD, or null.' },
        waiting_for: {
          type: 'string',
          enum: ['CLIENT', 'IOANNIS', 'ARTAN', 'SUPPLIER', 'INSTALLATION_TEAM', 'OTHER', 'NOTHING'],
        },
        waiting_for_detail: { type: 'string', maxLength: 500 },
      },
      required: ['lead_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_lead_note',
    description: 'Add a traceable internal note to an existing lead.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string' },
        category: { type: 'string', maxLength: 80 },
        content: { type: 'string', minLength: 1, maxLength: 5000 },
        is_pinned: { type: 'boolean', default: false },
      },
      required: ['lead_id', 'content'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_task',
    description: 'Create an operational task linked to one lead or job.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_id: { type: ['string', 'null'] },
        job_id: { type: ['string', 'null'] },
        title: { type: 'string', minLength: 1, maxLength: 200 },
        description: { type: 'string', maxLength: 2000 },
        owner: { type: 'string', maxLength: 120 },
        priority: { type: 'string', enum: PRIORITIES, default: 'NORMAL' },
        due_at: { type: ['string', 'null'], description: 'ISO date or date-time, or null.' },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_overdue_tasks',
    description: 'List incomplete tasks whose due date has passed. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
      },
      additionalProperties: false,
    },
  },
]

function rpc(id, result) {
  return Response.json({ jsonrpc: '2.0', id, result }, {
    headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  })
}

function rpcError(id, code, message) {
  return Response.json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }, { status: 400 })
}

function toolResult(value, isError = false) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
    ...(isError ? { isError: true } : {}),
  }
}

function clampLimit(value) {
  return Math.min(Math.max(Number(value) || 20, 1), 50)
}

async function callTool(env, actor, name, args) {
  if (name === 'search_leads') {
    const [leads, clients] = await Promise.all([listRecords(env.DB, 'leads'), listRecords(env.DB, 'clients')])
    const clientsById = new Map(clients.map((client) => [client.id, client]))
    const query = String(args.query || '').trim().toLowerCase()
    const matches = leads.filter((lead) => {
      const client = clientsById.get(lead.client_id) || {}
      const haystack = [lead.project_title, lead.description, lead.project_address, lead.postcode, client.name, client.company]
        .join(' ').toLowerCase()
      return (!query || haystack.includes(query))
        && (!args.status || lead.status === args.status)
        && (!args.priority || lead.priority === args.priority)
    }).slice(0, clampLimit(args.limit)).map((lead) => ({ ...lead, client: clientsById.get(lead.client_id) || null }))
    return toolResult({ count: matches.length, leads: matches })
  }

  if (name === 'get_lead') {
    const record = await readRecord(env.DB, 'leads', String(args.lead_id || ''))
    if (!record) return toolResult({ error: 'Lead not found' }, true)
    const [client, notes, tasks, activity] = await Promise.all([
      readRecord(env.DB, 'clients', record.value.client_id),
      listRecords(env.DB, 'notes'),
      listRecords(env.DB, 'tasks'),
      env.DB.prepare(`
        SELECT actor, actor_type, action, old_value_json, new_value_json, created_at
        FROM activity_log WHERE collection = 'leads' AND record_id = ?1
        ORDER BY created_at DESC LIMIT 20
      `).bind(record.value.id).all(),
    ])
    return toolResult({
      lead: record.value,
      version: record.version,
      client: client?.value || null,
      notes: notes.filter((note) => note.lead_id === record.value.id),
      tasks: tasks.filter((task) => task.lead_id === record.value.id),
      activity: activity.results,
    })
  }

  if (name === 'update_lead') {
    const record = await readRecord(env.DB, 'leads', String(args.lead_id || ''))
    if (!record) return toolResult({ error: 'Lead not found' }, true)
    const allowed = ['status', 'priority', 'next_action', 'next_action_owner', 'next_action_due', 'waiting_for', 'waiting_for_detail']
    const changes = Object.fromEntries(allowed.filter((key) => key in args).map((key) => [key, args[key]]))
    if (Object.keys(changes).length === 0) return toolResult({ error: 'No permitted changes supplied' }, true)
    const result = await writeRecord(env.DB, actor, 'leads', { ...record.value, ...changes }, record.version)
    return toolResult({ updated: result.value, version: result.version })
  }

  if (name === 'add_lead_note') {
    const leadId = String(args.lead_id || '')
    if (!await readRecord(env.DB, 'leads', leadId)) return toolResult({ error: 'Lead not found' }, true)
    const now = new Date().toISOString()
    const note = {
      id: crypto.randomUUID(),
      lead_id: leadId,
      job_id: null,
      category: String(args.category || 'BOT_NOTE').slice(0, 80),
      content: String(args.content || '').trim(),
      is_pinned: Boolean(args.is_pinned),
      created_by: actor.name,
      created_at: now,
      updated_at: now,
    }
    if (!note.content) return toolResult({ error: 'Note content is required' }, true)
    const result = await writeRecord(env.DB, actor, 'notes', note)
    return toolResult({ created: result.value })
  }

  if (name === 'create_task') {
    if (args.lead_id && args.job_id) return toolResult({ error: 'Link a task to either a lead or a job, not both' }, true)
    if (args.lead_id && !await readRecord(env.DB, 'leads', args.lead_id)) return toolResult({ error: 'Lead not found' }, true)
    if (args.job_id && !await readRecord(env.DB, 'jobs', args.job_id)) return toolResult({ error: 'Job not found' }, true)
    const now = new Date().toISOString()
    const task = {
      id: crypto.randomUUID(),
      lead_id: args.lead_id || null,
      quote_id: null,
      job_id: args.job_id || null,
      title: String(args.title || '').trim(),
      description: String(args.description || ''),
      owner: String(args.owner || 'Ioannis'),
      priority: PRIORITIES.includes(args.priority) ? args.priority : 'NORMAL',
      status: TASK_STATUSES[0],
      due_at: args.due_at || null,
      completed_at: null,
      created_at: now,
      updated_at: now,
    }
    if (!task.title) return toolResult({ error: 'Task title is required' }, true)
    const result = await writeRecord(env.DB, actor, 'tasks', task)
    return toolResult({ created: result.value })
  }

  if (name === 'get_overdue_tasks') {
    const today = new Date().toISOString()
    const tasks = (await listRecords(env.DB, 'tasks')).filter((task) => (
      task.status !== 'DONE' && task.due_at && task.due_at < today && (!args.owner || task.owner === args.owner)
    )).slice(0, clampLimit(args.limit))
    return toolResult({ count: tasks.length, tasks })
  }

  return toolResult({ error: `Unknown tool: ${name}` }, true)
}

export async function onRequestPost({ request, env }) {
  const actor = await authenticate(request, env)
  if (!actor) return unauthorized()

  let message
  try { message = await request.json() } catch { return rpcError(null, -32700, 'Parse error') }
  if (message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return rpcError(message.id, -32600, 'Invalid Request')
  }

  if (message.method === 'initialize') {
    return rpc(message.id, {
      protocolVersion: message.params?.protocolVersion || '2025-11-25',
      capabilities: { tools: {} },
      serverInfo: { name: 'artiling-jobs', version: '0.2.0' },
    })
  }
  if (message.method === 'server/discover') {
    return rpc(message.id, {
      protocolVersions: ['2026-07-28', '2025-11-25'],
      capabilities: { tools: {} },
      serverInfo: { name: 'artiling-jobs', version: '0.2.0' },
    })
  }
  if (message.method === 'notifications/initialized') return new Response(null, { status: 202 })
  if (message.method === 'tools/list') return rpc(message.id, { tools })
  if (message.method === 'tools/call') {
    const result = await callTool(env, actor, message.params?.name, message.params?.arguments || {})
    return rpc(message.id, result)
  }
  return rpcError(message.id, -32601, 'Method not found')
}

export async function onRequestGet() {
  return Response.json({
    name: 'Artiling Jobs MCP',
    transport: 'Streamable HTTP',
    authentication: 'Bearer token required',
  })
}
