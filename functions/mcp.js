import { authenticate, unauthorized } from './_shared/auth.js'
import { listRecords, readRecord, writeRecord } from './_shared/repository.js'

const LEAD_STATUSES = [
  'NEW', 'INFO_NEEDED', 'DESIGN_DISCUSSION', 'READY_TO_PRICE', 'WAITING_FOR_ARTAN',
  'READY_TO_QUOTE', 'QUOTE_IN_PREPARATION', 'QUOTE_SENT', 'WAITING_FOR_CLIENT',
  'MATERIAL_SELECTION', 'SAMPLES_TO_SEND', 'SAMPLES_SENT', 'WAITING_FOR_SAMPLE_FEEDBACK',
  'SITE_VISIT_NEEDED', 'SITE_VISIT_PROPOSED', 'SITE_VISIT_BOOKED', 'TEMPLATE_REQUIRED',
  'WAITING_FOR_DEPOSIT', 'APPROVED', 'WON', 'LOST', 'DORMANT',
]

const PROJECT_TYPES = [
  'BESPOKE_PORCELAIN_SINK', 'VANITY_AND_SINK', 'VANITY_TOP', 'WET_ROOM', 'LARGE_FORMAT_TILING',
  'FEATURE_WALL', 'PORCELAIN_STAIRS', 'OTHER_BESPOKE_FABRICATION', 'OTHER',
]
const WAITING_FOR = ['CLIENT', 'IOANNIS', 'ARTAN', 'SUPPLIER', 'INSTALLATION_TEAM', 'OTHER', 'NOTHING']
const OWNER_HINTS = ['Ioannis', 'Artan']
const PRIORITIES = ['HIGH', 'NORMAL', 'LOW']
const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'WAITING', 'DONE']

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/

const nullableDate = (description) => ({ type: ['string', 'null'], description })

const CLIENT_PROPERTIES = {
  name: { type: 'string', minLength: 1, maxLength: 200 },
  email: { type: 'string', maxLength: 254 },
  phone: { type: 'string', maxLength: 60 },
  company: { type: 'string', maxLength: 200 },
  preferred_contact: { type: 'string', maxLength: 60 },
  billing_address: { type: 'string', maxLength: 500 },
  notes: { type: 'string', maxLength: 5000 },
}

const LEAD_PROPERTIES = {
  project_title: { type: 'string', minLength: 1, maxLength: 200 },
  project_type: { type: 'string', enum: PROJECT_TYPES },
  description: { type: 'string', maxLength: 5000 },
  lead_source: { type: 'string', maxLength: 120 },
  status: { type: 'string', enum: LEAD_STATUSES },
  priority: { type: 'string', enum: PRIORITIES },
  project_address: { type: 'string', maxLength: 300 },
  postcode: { type: 'string', maxLength: 20 },
  waiting_for: { type: 'string', enum: WAITING_FOR },
  waiting_for_detail: { type: 'string', maxLength: 500 },
  next_action: { type: 'string', maxLength: 500 },
  next_action_owner: { type: 'string', maxLength: 120, description: `Usually one of: ${OWNER_HINTS.join(', ')}.` },
  next_action_due: nullableDate('ISO date YYYY-MM-DD, or null.'),
  last_client_contact_at: nullableDate('ISO date or date-time, or null.'),
  last_artiling_contact_at: nullableDate('ISO date or date-time, or null.'),
  artans_review_required: { type: 'boolean' },
}

const LEAD_UPDATE_PROPERTIES = {
  ...LEAD_PROPERTIES,
  won_at: nullableDate('ISO date or date-time, or null to clear.'),
  lost_at: nullableDate('ISO date or date-time, or null to clear.'),
  lost_reason: { type: 'string', maxLength: 500 },
}

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
        include_archived: { type: 'boolean', default: false, description: 'Also return archived leads.' },
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
    name: 'list_statuses',
    description: 'List the allowed values for lead status, project_type, priority, waiting_for and usual next_action_owner names. Read-only.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'create_client',
    description: 'Create a client record. Returns the client id to use with create_lead. Refuses an email that already belongs to a client.',
    inputSchema: {
      type: 'object',
      properties: CLIENT_PROPERTIES,
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_client',
    description: 'Correct contact details on an existing client.',
    inputSchema: {
      type: 'object',
      properties: { client_id: { type: 'string' }, ...CLIENT_PROPERTIES },
      required: ['client_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_lead',
    description: 'Create a lead for an existing client (client_id) or for a new client (inline client object). Does not create quotes, prices, jobs or payments.',
    inputSchema: {
      type: 'object',
      properties: {
        client_id: { type: 'string', description: 'Existing client. Provide this or client.' },
        client: {
          type: 'object',
          description: 'New client to create together with the lead. Provide this or client_id.',
          properties: CLIENT_PROPERTIES,
          required: ['name'],
          additionalProperties: false,
        },
        ...LEAD_PROPERTIES,
      },
      required: ['project_title'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_lead',
    description: 'Update identity and operational fields on a lead, including clearing won_at/lost_at. Does not change prices, quotes, jobs or payments.',
    inputSchema: {
      type: 'object',
      properties: { lead_id: { type: 'string' }, ...LEAD_UPDATE_PROPERTIES },
      required: ['lead_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'archive_lead',
    description: 'Hide a lead (for example demo data) from the pipeline without deleting it. Set archived=false to restore. Linked quotes, jobs and payments are left untouched.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string' },
        archived: { type: 'boolean', default: true },
        reason: { type: 'string', maxLength: 500 },
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

const CLIENT_TEXT_LIMITS = {
  name: 200, email: 254, phone: 60, company: 200, preferred_contact: 60, billing_address: 500, notes: 5000,
}
const LEAD_TEXT_LIMITS = {
  project_title: 200, description: 5000, lead_source: 120, project_address: 300, postcode: 20,
  waiting_for_detail: 500, next_action: 500, next_action_owner: 120, lost_reason: 500,
}
const LEAD_ENUMS = { status: LEAD_STATUSES, project_type: PROJECT_TYPES, priority: PRIORITIES, waiting_for: WAITING_FOR }
const LEAD_DATES = ['next_action_due', 'last_client_contact_at', 'last_artiling_contact_at', 'won_at', 'lost_at']
const LEAD_CREATE_KEYS = new Set([
  'client_id', 'client', 'project_title', 'project_type', 'description', 'lead_source', 'status', 'priority',
  'project_address', 'postcode', 'waiting_for', 'waiting_for_detail', 'next_action', 'next_action_owner',
  'next_action_due', 'last_client_contact_at', 'last_artiling_contact_at', 'artans_review_required',
])
const LEAD_UPDATE_KEYS = new Set([
  'lead_id', 'project_title', 'project_type', 'description', 'lead_source', 'status', 'priority',
  'project_address', 'postcode', 'waiting_for', 'waiting_for_detail', 'next_action', 'next_action_owner',
  'next_action_due', 'last_client_contact_at', 'last_artiling_contact_at', 'artans_review_required',
  'won_at', 'lost_at', 'lost_reason',
])

const fail = (message) => toolResult({ error: message }, true)

function rejectUnknown(args, allowed) {
  const unknown = Object.keys(args).filter((key) => !allowed.has(key))
  return unknown.length ? `Field not permitted: ${unknown.join(', ')}` : null
}

// Returns { changes } or { error }. Only keys present in args are validated and returned.
function readClientFields(args) {
  const changes = {}
  for (const [key, limit] of Object.entries(CLIENT_TEXT_LIMITS)) {
    if (!(key in args)) continue
    if (typeof args[key] !== 'string') return { error: `${key} must be a string` }
    const value = args[key].trim()
    if (value.length > limit) return { error: `${key} must be at most ${limit} characters` }
    if (key === 'name' && !value) return { error: 'Client name is required' }
    if (key === 'email' && value && !/^[^\s@]+@[^\s@]+$/.test(value)) return { error: 'email is not a valid address' }
    changes[key] = value
  }
  return { changes }
}

function readLeadFields(args) {
  const changes = {}
  for (const [key, limit] of Object.entries(LEAD_TEXT_LIMITS)) {
    if (!(key in args)) continue
    if (typeof args[key] !== 'string') return { error: `${key} must be a string` }
    const value = args[key].trim()
    if (value.length > limit) return { error: `${key} must be at most ${limit} characters` }
    if (key === 'project_title' && !value) return { error: 'project_title cannot be empty' }
    changes[key] = value
  }
  for (const [key, values] of Object.entries(LEAD_ENUMS)) {
    if (!(key in args)) continue
    if (!values.includes(args[key])) return { error: `${key} must be one of: ${values.join(', ')}` }
    changes[key] = args[key]
  }
  for (const key of LEAD_DATES) {
    if (!(key in args)) continue
    const value = args[key]
    if (value !== null && (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value)))) {
      return { error: `${key} must be an ISO date (YYYY-MM-DD), an ISO date-time, or null` }
    }
    changes[key] = value
  }
  if ('artans_review_required' in args) {
    if (typeof args.artans_review_required !== 'boolean') return { error: 'artans_review_required must be true or false' }
    changes.artans_review_required = args.artans_review_required
  }
  return { changes }
}

function newClient(fields) {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: '', company: '', email: '', phone: '', preferred_contact: '', billing_address: '', notes: '',
    ...fields,
    created_at: now,
    updated_at: now,
  }
}

function findClientByEmail(clients, email) {
  const wanted = String(email || '').trim().toLowerCase()
  return wanted ? clients.find((client) => String(client.email || '').trim().toLowerCase() === wanted) : null
}

function newLead(clientId, fields) {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    client_id: clientId,
    project_title: '',
    project_type: 'OTHER',
    description: '',
    lead_source: '',
    status: 'NEW',
    priority: 'NORMAL',
    project_address: '',
    postcode: '',
    waiting_for: 'NOTHING',
    waiting_for_detail: '',
    next_action: '',
    next_action_owner: 'Ioannis',
    next_action_due: null,
    last_client_contact_at: null,
    last_artiling_contact_at: null,
    artans_review_required: false,
    won_at: null,
    lost_at: null,
    lost_reason: '',
    ...fields,
    created_at: now,
    updated_at: now,
  }
}

function conflictResult() {
  return fail('Version conflict: the record changed while updating. Re-read it and retry.')
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
        && (args.include_archived === true || !lead.archived_at)
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

  if (name === 'list_statuses') {
    return toolResult({
      status: LEAD_STATUSES,
      project_type: PROJECT_TYPES,
      priority: PRIORITIES,
      waiting_for: WAITING_FOR,
      next_action_owner_examples: OWNER_HINTS,
      date_formats: 'next_action_due: YYYY-MM-DD. Contact and won/lost timestamps: ISO date or date-time.',
    })
  }

  if (name === 'create_client') {
    const unknown = rejectUnknown(args, new Set(Object.keys(CLIENT_TEXT_LIMITS)))
    if (unknown) return fail(unknown)
    const { changes, error } = readClientFields(args)
    if (error) return fail(error)
    if (!changes.name) return fail('Client name is required')
    const clients = await listRecords(env.DB, 'clients')
    const duplicate = findClientByEmail(clients, changes.email)
    if (duplicate) return fail(`A client with this email already exists (client_id ${duplicate.id}, ${duplicate.name}). Use that id or update_client.`)
    const sameName = clients.filter((client) => String(client.name).trim().toLowerCase() === changes.name.toLowerCase())
    const result = await writeRecord(env.DB, actor, 'clients', newClient(changes))
    return toolResult({
      client_id: result.value.id,
      client: result.value,
      ...(sameName.length ? { warning: 'Other clients share this name', possible_duplicates: sameName.map(({ id, name, email }) => ({ id, name, email })) } : {}),
    })
  }

  if (name === 'update_client') {
    const unknown = rejectUnknown(args, new Set(['client_id', ...Object.keys(CLIENT_TEXT_LIMITS)]))
    if (unknown) return fail(unknown)
    const record = await readRecord(env.DB, 'clients', String(args.client_id || ''))
    if (!record) return fail('Client not found')
    const { changes, error } = readClientFields(args)
    if (error) return fail(error)
    if (Object.keys(changes).length === 0) return fail('No permitted changes supplied')
    if (changes.email) {
      const duplicate = findClientByEmail(await listRecords(env.DB, 'clients'), changes.email)
      if (duplicate && duplicate.id !== record.value.id) return fail(`Another client already uses this email (client_id ${duplicate.id}, ${duplicate.name}).`)
    }
    const result = await writeRecord(env.DB, actor, 'clients', { ...record.value, ...changes }, record.version)
    if (result.conflict) return conflictResult()
    return toolResult({ updated: result.value, version: result.version })
  }

  if (name === 'create_lead') {
    const unknown = rejectUnknown(args, LEAD_CREATE_KEYS)
    if (unknown) return fail(unknown)
    if (args.client_id && args.client) return fail('Provide client_id or client, not both')
    if (!args.client_id && !args.client) return fail('Provide client_id (existing client) or client (new client)')
    const { changes, error } = readLeadFields(args)
    if (error) return fail(error)
    if (!changes.project_title) return fail('project_title is required')

    let existingClient = null
    let clientFields = null
    if (args.client_id) {
      existingClient = await readRecord(env.DB, 'clients', String(args.client_id))
      if (!existingClient) return fail('Client not found')
    } else {
      if (typeof args.client !== 'object' || Array.isArray(args.client)) return fail('client must be an object')
      const unknownClient = rejectUnknown(args.client, new Set(Object.keys(CLIENT_TEXT_LIMITS)))
      if (unknownClient) return fail(unknownClient)
      const parsed = readClientFields(args.client)
      if (parsed.error) return fail(parsed.error)
      if (!parsed.changes.name) return fail('Client name is required')
      const duplicate = findClientByEmail(await listRecords(env.DB, 'clients'), parsed.changes.email)
      if (duplicate) return fail(`A client with this email already exists (client_id ${duplicate.id}, ${duplicate.name}). Pass client_id instead.`)
      clientFields = parsed.changes
    }

    const client = existingClient ? existingClient.value : (await writeRecord(env.DB, actor, 'clients', newClient(clientFields))).value
    const result = await writeRecord(env.DB, actor, 'leads', newLead(client.id, changes))
    return toolResult({ lead_id: result.value.id, client_id: client.id, lead: result.value, client })
  }

  if (name === 'update_lead') {
    const unknown = rejectUnknown(args, LEAD_UPDATE_KEYS)
    if (unknown) return fail(unknown)
    const record = await readRecord(env.DB, 'leads', String(args.lead_id || ''))
    if (!record) return fail('Lead not found')
    const { changes, error } = readLeadFields(args)
    if (error) return fail(error)
    if (Object.keys(changes).length === 0) return fail('No permitted changes supplied')
    const result = await writeRecord(env.DB, actor, 'leads', { ...record.value, ...changes }, record.version)
    if (result.conflict) return conflictResult()
    return toolResult({ updated: result.value, version: result.version })
  }

  if (name === 'archive_lead') {
    const unknown = rejectUnknown(args, new Set(['lead_id', 'archived', 'reason']))
    if (unknown) return fail(unknown)
    const record = await readRecord(env.DB, 'leads', String(args.lead_id || ''))
    if (!record) return fail('Lead not found')
    if ('archived' in args && typeof args.archived !== 'boolean') return fail('archived must be true or false')
    if ('reason' in args && (typeof args.reason !== 'string' || args.reason.length > 500)) return fail('reason must be a string of at most 500 characters')
    const archive = args.archived !== false
    const next = archive
      ? { ...record.value, archived_at: new Date().toISOString(), archived_reason: String(args.reason || '').trim() }
      : { ...record.value, archived_at: null, archived_reason: '' }
    const result = await writeRecord(env.DB, actor, 'leads', next, record.version)
    if (result.conflict) return conflictResult()
    return toolResult({ archived: archive, lead: result.value, version: result.version })
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
      serverInfo: { name: 'artiling-jobs', version: '0.3.0' },
    })
  }
  if (message.method === 'server/discover') {
    return rpc(message.id, {
      protocolVersions: ['2026-07-28', '2025-11-25'],
      capabilities: { tools: {} },
      serverInfo: { name: 'artiling-jobs', version: '0.3.0' },
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
    authentication: 'OAuth 2.1 authorization code with PKCE',
  })
}
