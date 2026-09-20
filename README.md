# Artiling Jobs — Phase 1

Private operations application for Artiling Studio. The runnable Phase 1 prototype uses React 19, TypeScript and Vite, with a typed local repository persisted in browser storage. The repository boundary is intentionally isolated so it can be replaced by the PostgreSQL schema in `database/001_phase1_foundation.sql` without changing page components.

## Run locally

```powershell
npm install
npm run dev
```

The prototype login accepts any non-empty email and password of four or more characters. This is an authentication boundary, not production identity. Connect an identity provider before deployment.

## Validation

```powershell
npm run typecheck
npm test
npm run build
```

## Production setup decisions

- The Cloudflare Phase 2 backend uses the D1 migration in `database/002_cloudflare_d1.sql`.
- The Pages project expects a D1 binding named `DB`.
- Human API access requires a cryptographically validated Cloudflare Access JWT. Configure
  `TEAM_DOMAIN` and `POLICY_AUD` after creating the Access application.
- Grok/MCP access requires an encrypted `BOT_API_TOKEN` secret. Never put the value in Git.
- The current frontend repository remains local-first until the authenticated API migration is
  completed; do not treat browser `localStorage` as shared production data.
- Connect a private object-storage provider for documents; the UI intentionally stores metadata only.
- Configure Cloudflare Access before bootstrapping shared production data.

## Bot integration

The Streamable HTTP MCP endpoint is `/mcp`. It exposes a deliberately small tool surface:

- `search_leads` and `get_lead` (read; archived leads are hidden unless `include_archived`)
- `list_lead_enums` for the allowed status, project type, priority and waiting-for values
- `create_client` and `update_client`
- `create_lead` (existing `client_id` or an inline `client`) and `update_lead`, which covers identity
  fields (title, type, description, source, address, postcode), pipeline fields, contact dates,
  `won_at`/`lost_at` (nullable) and `lost_reason`
- `archive_lead` hides a lead from the UI without deleting it; `archived: false` restores it
- `add_lead_note`
- `create_task` and `get_overdue_tasks`

Unknown or protected fields are rejected with an error rather than ignored. Bots cannot delete
records or write quotes, payments, jobs, materials, documents, or settings. Archiving a lead does
not touch its linked quotes, jobs or tasks. Every write creates an immutable entry in the backend
`activity_log` table.
