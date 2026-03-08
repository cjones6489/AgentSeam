# AgentSeam Roadmap

## Completed

### Phase 0 — Repo Setup
- Next.js app with TypeScript, Tailwind, shadcn/ui
- Supabase connection (auth + Postgres)
- Drizzle ORM with migrations
- ESLint, Vitest, pnpm workspace

### Phase 1 — Core Backend
- `actions` table with full lifecycle schema
- Create, get, approve, reject, result API routes
- Explicit state machine with optimistic locking
- Zod validation on all boundaries

### Phase 2 — Inbox UI + Auth
- Supabase email/password auth (signup, login, session refresh)
- Dashboard shell with sidebar navigation
- Inbox page with status tabs and action table
- Action detail page with payload viewer and approve/reject controls
- TanStack Query data layer with mutations and cache invalidation

### Phase 3 — API Keys + Dashboard Completion
- `api_keys` table with SHA-256 hashing
- Settings page: create, name, revoke API keys
- History page with status filters
- Per-user action ownership (`ownerUserId`)
- DB-backed API key auth for SDK routes

### Phase 4 — SDK Package
- `@agentseam/sdk` TypeScript package at `packages/sdk/`
- `AgentSeam` client with `proposeAndWait`, `createAction`, `getAction`, `waitForDecision`, `markResult`
- Polling-based approval wait strategy
- Custom error types: `AgentSeamError`, `TimeoutError`, `RejectedError`
- 16 unit tests, tsup build (ESM + CJS + types)
- Demo script: `examples/demo-send-email.ts`

---

## Next Up

### Phase 5 — MCP Server Adapter
Build a first-class MCP server so any MCP-compatible client (Claude Desktop, Cursor, etc.) can propose actions through AgentSeam without custom integration code.

- New package at `packages/mcp-server/`
- Tools: `propose_action`, `check_action`, `list_pending`
- Uses `@agentseam/sdk` internally
- Configurable via env vars (`AGENTSEAM_URL`, `AGENTSEAM_API_KEY`)
- Publishable as `@agentseam/mcp-server` / installable via `npx`
- Estimated effort: ~1 day

### Phase 6 — Signed Receipts
Cryptographic proof of every action lifecycle event. Every approval, rejection, and execution produces a signed, verifiable receipt.

- `receipts` table: action_id, event_type, hash, previous_hash, signature
- Ed25519 key pair for signing
- Chain hashed events per action for tamper evidence
- Public receipt viewer page (e.g. `/receipt/[id]`)
- Exportable receipt JSON
- Pitch: "Not just approval — proof."
- Estimated effort: 2-3 days

### Phase 7 — Notification Channels
Notify users about pending actions through channels beyond the web dashboard.

**Slack (with interactive buttons)** — ~1 day
- Incoming webhook for notifications
- Interactive message buttons for approve/reject directly in Slack
- Slack callback route (`/api/webhooks/slack`)
- Webhook URL configuration in Settings

**PWA + Web Push** — ~1-2 days
- `manifest.json` and service worker for installable mobile experience
- Web Push API for notifications when new actions arrive
- Works on Android and iOS Safari (16.4+)

**SMS (Twilio)** — ~1-2 days
- SMS notification when actions are created
- Link to dashboard for approval
- Phone number configuration in Settings
- Optional: reply "YES" to approve via SMS

**iOS App (Expo/React Native)** — 1-2 weeks
- Login, inbox, action detail, approve/reject
- Push notifications via Expo
- Only if mobile becomes a core selling point

Priority order: Slack → PWA → SMS → Native app

---

## Future (Post-Launch)

### Developer Experience
- Python SDK (direct port of TypeScript client)
- Additional demo scripts (HTTP POST, shell command, stock trade)
- CLI tool for creating actions from the terminal

### Product Features
- Auto-approve rules (approve all actions matching a pattern)
- Allowlists / blocklists
- Action templates and grouping
- Multiple environments with separate policies
- Bulk approve/reject
- Action expiration (TTL on pending actions)

### Integrations
- Framework adapters (LangChain, CrewAI, AutoGen)
- OpenAI function call wrapper
- Discord approval channel
- Email notifications with one-click approve links

### Enterprise
- Team/org management
- Role-based access control
- Audit log exports
- SSO
- Self-hosted deployment option

### Infrastructure
- Real-time updates (WebSocket/SSE instead of polling)
- Action event timeline table (`action_events`)
- Webhook system for external integrations
- Rate limiting and usage quotas
