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
- Documents are stored in R2. Create a bucket named `artiling-jobs-documents` and bind it to the
  Pages project as `DOCUMENTS`; the binding is already declared in `wrangler.jsonc`. Until the
  bucket exists, uploading returns a 503 that says so.
- Configure Cloudflare Access before bootstrapping shared production data.

## Bot integration

### Connecting a client

Add the connector with the server URL alone — `https://artiling-jobs.pages.dev/mcp` — and sign in
with Cloudflare Access when prompted. No client id or secret is entered by hand: the client reads
the discovery documents and registers itself.

Cloudflare Access guards the whole site except `/mcp*` and `/oauth/token`, so the discovery
documents and the registration endpoint are published under `/mcp/`, and the issuer is the
resource itself:

| Endpoint | Purpose | Behind Access |
| --- | --- | --- |
| `/mcp/.well-known/oauth-protected-resource` | RFC 9728 resource metadata | no |
| `/mcp/.well-known/oauth-authorization-server` | RFC 8414 server metadata | no |
| `/mcp/register` | RFC 7591 registration | no |
| `/oauth/token` | Token exchange | no |
| `/oauth/authorize` | Human login step | yes, by design |

Registration only issues public PKCE clients whose redirect URIs are already on the `grok.com`
allow-list, and the redirect is checked again against the registered set when authorizing.
Registration grants nothing on its own — `/oauth/authorize` still refuses to issue a code without a
Cloudflare Access login. Registered client ids are signed rather than stored, so there is no
database migration. The older static `GROK_OAUTH_CLIENT_ID` / `GROK_OAUTH_CLIENT_SECRET` pair still
works if it is configured.

If a client only looks for discovery at the site root, add a Cloudflare Access bypass policy for
`/.well-known/*`; the same documents are already served there.

## Document files

Quotes, drawings and site photos are uploaded from the Documents page and stored in R2 under a
server-generated key, so an uploaded file name never becomes a path. `/api/files` accepts the
upload and `/api/files/documents/<key>` serves it back.

Only a signed-in human can upload, read or delete a file; bots have no access to documents, which
matches the records API. Files are capped at 25MB. Types that can carry script, such as SVG and
HTML, are refused, and anything the browser should not render is served as a download with
`nosniff` and a sandboxing `Content-Security-Policy`, so an upload cannot execute in the
application's origin.

### Tools

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
