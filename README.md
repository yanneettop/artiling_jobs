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

- Apply `database/001_phase1_foundation.sql` to a new PostgreSQL database.
- Replace the local repository provider with authenticated API/database methods.
- Connect a private object-storage provider for documents; the UI intentionally stores metadata only.
- Configure real identity/session handling and enforce the prepared roles server-side.
