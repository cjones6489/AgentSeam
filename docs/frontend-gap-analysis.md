# Frontend Gap Analysis & Phase Breakdown

> **Purpose:** This document maps every backend capability to its frontend
> status (surfaced, partially surfaced, or missing). It then breaks the
> remaining work into independent, shippable phases. Each phase will get its
> own build plan when we are ready to execute it.
>
> **Relationship to master roadmap:** This covers the "Phase 5: Dashboard & API"
> from `docs/finops-pivot-roadmap.md`, broken into sub-phases sized for
> incremental delivery.
>
> **Last audited:** 2026-03-07 (Phase 3B complete)

---

## 1. Backend Capability Inventory

### 1.1 Proxy (Cloudflare Worker at `apps/proxy/`)

The proxy intercepts LLM API calls and produces the following data on every
request:

| Data Point | Source | Stored In |
|---|---|---|
| Provider | Always `"openai"` (Anthropic support is a separate effort in finops roadmap Phase 3, not this document's phases) | `cost_events.provider` |
| Model | Request/response body | `cost_events.model` |
| Input tokens | `usage.prompt_tokens` | `cost_events.input_tokens` |
| Output tokens | `usage.completion_tokens` | `cost_events.output_tokens` |
| Cached input tokens | `usage.prompt_tokens_details.cached_tokens` | `cost_events.cached_input_tokens` |
| Reasoning tokens | `usage.completion_tokens_details.reasoning_tokens` | `cost_events.reasoning_tokens` |
| Cost (microdollars) | Cost engine calculation | `cost_events.cost_microdollars` |
| Duration (ms) | `performance.now()` start-to-finish | `cost_events.duration_ms` |
| Request ID | Upstream `x-request-id` or generated UUID | `cost_events.request_id` |
| API Key ID | `x-agentseam-key-id` header | `cost_events.api_key_id` |
| User ID | `x-agentseam-user-id` header | `cost_events.user_id` |

**Important detail:** `reasoningTokens` is extracted and stored but NOT used in
cost calculation (reasoning tokens are a subset of `completion_tokens` and
already billed at the output rate). The UI should display reasoning tokens
separately for transparency.

Enforcement mechanisms:

| Mechanism | Description |
|---|---|
| Platform auth | `X-AgentSeam-Auth` header, timing-safe comparison |
| Rate limiting | 120 req/min per IP via Upstash Ratelimit |
| Body size limit | 1 MB max request body |
| Model allowlist | Only known models accepted (400 for unknown) |
| Budget check-and-reserve | Atomic Redis Lua script; 429 if budget exceeded |
| Budget reconciliation | Replace reserved amount with actual cost after response |

**Budget denial response (429):** When a request is blocked, the proxy returns
a rich error body that could be surfaced in the UI:

```json
{
  "error": "budget_exceeded",
  "message": "Request blocked: estimated cost exceeds remaining budget",
  "details": {
    "entity_key": "{budget}:api_key:{id}",
    "remaining_microdollars": 500000,
    "estimated_microdollars": 750000,
    "budget_limit_microdollars": 10000000,
    "spent_microdollars": 9500000
  }
}
```

**Pre-request cost estimation:** Before forwarding to the upstream provider,
the proxy estimates max cost using `JSON.stringify(body).length / 4` for
input tokens and `max_completion_tokens` or model-specific caps for output
tokens, with a 1.1x safety margin. Estimated vs actual cost could be
surfaced for accuracy monitoring.

**Local dev caveat:** When connecting to a local Postgres, cost events and
budget spend updates are console.logged but NOT persisted. The seed script
is essential for testing the UI locally.

### 1.2 Cost Engine (`packages/cost-engine/`)

19 models across 3 providers with full pricing data:

| Provider | Models | Notes |
|---|---|---|
| OpenAI | gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, o4-mini, o3, o3-mini, o1, gpt-5, gpt-5-mini, gpt-5-nano, gpt-5.1, gpt-5.2 | 14 models |
| Anthropic | claude-sonnet-4-6, claude-haiku-3.5, claude-opus-4 | 3 models; includes cache write pricing (5m + 1h tiers) |
| Google | gemini-2.5-pro, gemini-2.5-flash | 2 models; pricing ready, proxy support not yet built |

**Missing model metadata:** The cost engine has pricing data only. It does NOT
have context window sizes, display names, or capability flags. If the UI
needs human-readable model names (e.g., "GPT-4o" instead of "gpt-4o"), a
display-name mapping will need to be created.

### 1.3 Database Tables (`packages/db/src/schema.ts`)

| Table | Purpose | Row Count Expectation |
|---|---|---|
| `api_keys` | API key management (hash, prefix, owner) | Low (handful per user) |
| `actions` | Human-in-the-loop approval lifecycle | Medium (grows with agent usage) |
| `budgets` | Spending limits per entity (user or API key) | Low (1-5 per user) |
| `cost_events` | Append-only ledger of every proxied API call | High (grows with every request) |
| `slack_configs` | Per-user Slack notification config | Low (1 per user) |

**Indexes that exist but have no corresponding query:**

The `cost_events` table has 4 indexes designed for queries that do not exist
yet on the dashboard:

- `cost_events_request_id_provider_idx` -- **UNIQUE** index; lookup by request ID
  (guarantees one cost event per requestId+provider pair, simplifies Phase 3B
  correlation)
- `cost_events_user_id_created_at_idx` -- list by user over time
- `cost_events_api_key_id_created_at_idx` -- list by API key over time
- `cost_events_provider_model_created_at_idx` -- aggregate by provider/model

These indexes validate the Phase 3A and 3C plans. The queries they support
are exactly the queries we need to build.

**Columns that exist but are not shown in the UI:**

- `budgets.policy` -- always `"strict_block"`, returned by API but not
  displayed. Will matter when advanced policies ship.
- `api_keys.lastUsedAt` -- shown in Settings, but not correlated with
  cost events (could show "last used: 2 min ago, $0.03 last call").
- `actions.approvedBy` / `actions.rejectedBy` -- stores the user ID of who
  took the action (dashboard user or Slack callback). Not shown on the action
  detail page or timeline. Important for audit trail and distinguishing
  dashboard vs Slack approvals.
- `actions.status = "executing"` -- valid status, but has no dedicated filter
  tab in Inbox or History. The History page's `HISTORY_STATUSES` set excludes
  it, so in-flight actions are invisible in History's "All" tab.

### 1.4 API Routes (Next.js at `app/api/`)

17 routes exist across actions, budgets, keys, and Slack. Full list:

**Actions:** GET/POST `/api/actions`, GET `/api/actions/[id]`, POST approve/reject/result

**Budgets:** GET/POST `/api/budgets`, DELETE/POST `/api/budgets/[id]`

**Keys:** GET/POST `/api/keys`, DELETE `/api/keys/[id]`

**Slack:** GET/POST/DELETE `/api/slack/config`, POST `/api/slack/test`, POST `/api/slack/callback`

**Known bug:** The budgets GET route uses raw SQL `IN ${keyIds}` which may not
produce valid SQL in all cases. Should use Drizzle's `inArray()` helper.
Track as a fix in Phase 3D.

---

## 2. Frontend Coverage Map

### 2.1 What IS surfaced

| Backend Data | Frontend Location | Status |
|---|---|---|
| `actions` (full lifecycle) | Inbox, History, Action Detail | **Complete** -- list, filter, detail, approve, reject |
| `api_keys` (CRUD) | Settings page | **Complete** -- create, view prefix, revoke |
| `budgets` (CRUD + spend totals) | Budgets page | **Complete** -- create, view, reset, delete, progress bars |
| `cost_events` (per-call cost log) | Activity page | **Complete** -- list, filter by key, cursor pagination, token breakdowns |
| `slack_configs` | Settings page | **Complete** -- connect, toggle, test, disconnect |

### 2.2 What is NOT surfaced

| Backend Data | Frontend Status | Impact | Phase |
|---|---|---|---|
| `cost_events` (per-call cost log) | **Visible on Activity page (Phase 3A complete)** | ~~Critical~~ Done | ~~3A~~ |
| Cost on individual actions | **Shown on action detail page via CostCard (Phase 3B complete)** | ~~High~~ Done | ~~3B~~ |
| Spend breakdown by model | **Not available anywhere** | High | 3C |
| Spend over time (trend) | **Not available anywhere** | Medium | 3C |
| Spend by API key | **Not available anywhere** | Medium | 3C |
| Budget denial details | **429 body has rich data, not shown to dashboard users** | Medium | 3C |
| Reasoning token breakdown | **Displayed on Activity page (Phase 3A complete)** | ~~Low~~ Done | ~~3A~~ |
| Who approved/rejected actions | **`approvedBy`/`rejectedBy` stored but not shown in UI** | Medium | 3D |
| `executing` status visibility | **No filter tab; excluded from History "All" tab** | Low | 3D |
| Action type API filter | **`GET /api/actions` only filters by `status`, not `actionType`** | Low | 3D |
| Edit budget limit | **API supports upsert, but UI only offers create/delete/reset** | Medium | 3D |
| Model pricing reference | **19 models priced, not viewable by users** | Low | Future |
| Upstream latency (time OpenAI takes) | **Not measured or stored** | Medium | 5 |
| Proxy overhead (our added latency) | **Not measured or stored** | Medium | 5 |
| Tokens per second | **Derivable from existing data, not computed** | Low | 5 |
| Pre-request cost estimates | **Proxy estimates cost before calls, not surfaced** | Low | Future |
| Rate limit status | **Proxy sets headers, not surfaced** | Low | Future |
| Redis budget state (reservations) | **Internal implementation detail** | Low | N/A |

### 2.3 Partial Coverage (works but has gaps)

| Area | What Works | What's Missing |
|---|---|---|
| Inbox | List + filter + detail | No pagination (capped at 50), no cost info |
| History | List + filter + search | No pagination (capped at 100), no cost info |
| Budgets | Budget CRUD + progress bars | No analytics, no breakdowns (cost event log is now on dedicated Activity page) |
| Action Detail | Payload, metadata, result, timeline, cost card | Does not show `approvedBy`/`rejectedBy` (who acted) |
| Create Budget dialog | Works | "Monthly limit" label doesn't match selected interval; no "edit" mode for existing budgets |
| Budget `currentPeriodStart` | Not set on creation | `POST /api/budgets` doesn't initialize `currentPeriodStart`, so "days left" is always null for real budgets (only seed script sets it) |
| Command palette search | Uses `cmdk` built-in text filter | Only matches visible text (action type, agent ID); can't search by ID, status, or metadata |
| Budgets GET route | Works | Raw SQL `IN` clause should use Drizzle `inArray()` |
| `slack_configs` schema | Has `slackUserId` column in Drizzle schema | Column missing from actual DB table (migration gap) |

---

## 3. Phase Breakdown

Each phase is independent and shippable. We build one at a time. When ready
to start a phase, we create a focused build plan with specific file-level
tasks.

### Phase 3A: Cost Events Visibility

**Goal:** Make the `cost_events` data visible. Users can see every API call
that flowed through the proxy with model, tokens, cost, and duration.

**What it delivers:**
- New API route: `GET /api/cost-events` (session auth, pagination, filters)
- New Zod schemas: `lib/validations/cost-events.ts`
- New query hook: `lib/queries/cost-events.ts`
- Dedicated Activity page (`/app/activity`) with cost events table, API key filter, cursor pagination
- Seed script for realistic cost event data (essential because local dev
  does not persist cost events to Postgres)

**Key design decisions:**
- Scope cost events to the current user by joining `cost_events.apiKeyId`
  to `api_keys` where `api_keys.userId` = session user. The `cost_events.userId`
  column stores the proxied agent's user ID, NOT the dashboard user.
- Support filtering by `apiKeyId` and `model` (the finops roadmap also
  mentions `provider` and date range filters, but `provider` is always
  `"openai"` for now, and date range is deferred to Phase 3C analytics)
- Cursor-based pagination (same pattern as actions API)
- Table follows `frontend-design.mdc` design system
- Display reasoning tokens separately from output tokens for transparency
  (reasoning tokens are a subset of output tokens, stored but not separately
  billed -- users should see the breakdown)
- Use existing `cost_events` indexes: `api_key_id_created_at` for the
  default query, `provider_model_created_at` for model filter

**Token display format:**
- Input: show total with cached breakdown (e.g., "1,200 (340 cached)")
- Output: show total with reasoning breakdown (e.g., "800 (200 reasoning)")
- This surfaces data that competitors hide
- Requires a new `formatTokens(n: number)` utility (`lib/utils/format.ts`
  currently has `formatMicrodollars` but no token formatter)

**Endpoint naming:** This document uses `GET /api/cost-events`. The finops
roadmap uses `GET /api/costs/events`. We use `cost-events` to match the DB
table name and keep the URL flat.

**Activity page:** Cost events live on their own dedicated page at `/app/activity`
under the FinOps sidebar section. This was moved from the Usage page during the
navigation restructure to give cost events room to grow (Phase 3C analytics,
Phase 5 performance monitoring).

**Existing patterns to follow:**
- Auth: `resolveSessionUserId()` from `@/lib/auth/session`
- Pagination: cursor shape `{ createdAt: string, id: string }`, SQL pattern
  `(createdAt < cursor) OR (createdAt = cursor AND id < cursorId)`,
  fetch `limit + 1`, use extra row for next cursor
- Response shape: `{ data: T[], cursor: { createdAt, id } | null }` with Zod
- Errors: `handleRouteError(error)` from `@/lib/utils/http`
- Query keys: `costEventKeys = { all, lists, list(filters) }`
- API client: `apiGet(\`/api/cost-events?${params.toString()}\`)`
- Seed script: follows `scripts/seed-budgets.ts` pattern (direct postgres
  connection, `db.insert().values().onConflictDoUpdate()`)

**NOTE:** The existing `useActions` hook does NOT implement cursor pagination
on the client side (it always fetches a single page). The Phase 3A cost
events hook SHOULD support cursor from the start since cost events will be
the highest-volume table. Use a "Load More" button pattern.

**Files involved:** ~6-8 new/modified files

**Depends on:** Nothing. Fully independent.

**Reference:** `finops-pivot-roadmap.md` Phase 5, items 3 and 5.

---

### Phase 3B: Cost on Action Detail -- COMPLETE

**Goal:** Connect the action lifecycle to cost data. When a user views an
approved/executed action, they see what it cost.

**What was delivered:**
- Added `actionId` nullable FK column to `cost_events` table with index
- Proxy reads `x-agentseam-action-id` header and stores it in `cost_events`
- New API route: `GET /api/actions/[id]/costs` with ownership verification
- New `CostCard` component on action detail page (status-aware, only shows for executing/executed/failed)
- SDK `proposeAndWait` passes `{ actionId }` context to the `execute` callback (backwards-compatible)
- Seed script updated to correlate ~35% of cost events with executed/failed actions

**Correlation approach:** Option B was chosen -- `actionId` column on `cost_events`
with `x-agentseam-action-id` header passed through the proxy. This is opt-in for
SDK `proposeAndWait` users. MCP proxy tool calls cannot be correlated with LLM
costs in the current architecture (deferred to Phase 4).

---

### Phase 3C: Usage Analytics

**Goal:** Add a dedicated Analytics page under the FinOps sidebar section with
charts and spend breakdowns.

**What it delivers:**
- New aggregation API: `GET /api/cost-events/summary` (group by model, day, apiKey)
- Spend-over-time chart (daily spend for 7d/30d/90d)
- Model breakdown table or chart
- Per-API-key spend comparison

**Key design decisions:**
- Aggregation done in SQL (Drizzle `sql` template), not client-side
- Chart library: recharts or chart.js (both work with dark theme)
- Period selector: 7d / 30d / 90d tabs
- Keep it simple -- 2-3 visualizations, not a BI tool

**Files involved:** ~4-5 new/modified files

**Depends on:** Phase 3A (needs cost events data flowing).

**Reference:** `finops-pivot-roadmap.md` Phase 5, item 1.

---

### Phase 3D: Pagination & Polish

**Goal:** Handle real traffic volumes and clean up rough edges.

**What it delivers:**
- Cursor-based pagination on Inbox and History pages
- Delete unused `components/settings/budgets-section.tsx`
- Fix "Monthly limit" label in create budget dialog
- Context-aware back-link on action detail page
- Fix budgets GET route: replace raw SQL `IN ${keyIds}` with Drizzle `inArray()`
- Run `slack_configs` migration to add `slack_user_id` column (or remove from schema)
- Fix `POST /api/budgets` to initialize `currentPeriodStart` to `NOW()` when
  `resetInterval` is provided (currently left null, breaking "days left" display)
- Add "Edit Budget" capability to the Budgets page (API already supports upsert)
- Show `approvedBy` / `rejectedBy` on action detail page and in timeline
- Add `executing` to History page's `HISTORY_STATUSES` set so in-flight actions
  are visible in the "All" tab

**Key design decisions:**
- The API already supports `cursor` param; this is frontend-only work
- "Load more" button pattern (not infinite scroll -- simpler, more predictable)
- `approvedBy`/`rejectedBy` display: show "Approved by Dashboard" vs
  "Approved via Slack" in the timeline (resolve user ID display later)
- Edit budget: reuse `CreateBudgetDialog` with pre-filled values; the POST
  endpoint's `onConflictDoUpdate` handles the upsert

**Files involved:** ~8-10 files

**Depends on:** Nothing. Can run in parallel with any other phase.

**Reference:** General UX polish, not from a specific roadmap item.

### Phase 5: Performance Monitoring

**Goal:** Add granular latency measurement to the proxy so users can monitor
performance, identify slow calls, and verify that the proxy adds minimal
overhead.

**Why after Phase 3 and 4:** Phase 3 surfaces what we already store
(`duration_ms`). Phase 4 (MCP tool cost tracking from the finops roadmap)
expands what we track. Phase 5 adds depth to how we measure. By this point
we'll have real user traffic to validate whether proxy overhead is a concern.

**What it delivers:**
- Proxy change: add `performance.now()` around the upstream `fetch()` call to
  capture `upstream_duration_ms`
- New column in `cost_events`: `upstream_duration_ms`
- Derived metric: `proxy_overhead_ms = duration_ms - upstream_duration_ms`
- Derived metric: `tokens_per_second = output_tokens / (duration_ms / 1000)`
- New "Performance" section on the Usage analytics page:
  - Average latency by model
  - p95 latency
  - Average proxy overhead (the trust signal: "we add Xms")
  - Tokens/sec by model
- Optional: latency sparkline on the cost event log table

**What we currently store vs. what this adds:**

| Metric | Today | After Phase 5 |
|---|---|---|
| Total request duration | Yes (`duration_ms`) | Yes |
| Upstream provider time | No | Yes (`upstream_duration_ms`) |
| Proxy overhead | No | Yes (derived) |
| Tokens per second | No | Yes (derived from existing data) |
| Budget check latency | No | No (too granular for v1) |
| Time to first byte | No | No (would require streaming-level instrumentation) |

**Key design decisions:**
- Only add `upstream_duration_ms` to the proxy and `cost_events` table.
  `proxy_overhead_ms` and `tokens_per_second` are derived in the API or UI,
  not stored separately.
- Budget check latency and time-to-first-byte are out of scope -- too
  granular for v1 and would require significant proxy refactoring.
- The analytics API from Phase 3C (`GET /api/cost-events/summary`) would be
  extended with a `groupBy: "model"` + `metrics: ["avg_duration", "p95_duration",
  "avg_overhead"]` option rather than creating a new endpoint.

**Files involved:** ~3-4 files (proxy timing change, migration, analytics API
extension, Analytics page section)

**Depends on:** Phase 3C (needs the analytics page and aggregation API), and
finops Phase 4 (MCP tracking) should ship first so MCP tool call durations
are included in the performance view.

**Estimated effort:** 1-2 days.

---

## 4. Dependency Graph

```
Sidebar: Approvals (Inbox, History) | FinOps (Budgets, Activity) | Configure (Settings)

Phase 3A (Cost Events Visibility) -- COMPLETE; Activity page at /app/activity
  │
  ├──> Phase 3B (Cost on Action Detail) -- COMPLETE; CostCard + actionId correlation
  │
  └──> Phase 3C (Analytics Page) -- new page under FinOps, needs cost event data
          │
          └──> Phase 5 (Performance Monitoring) -- needs analytics page
  
Phase 3D (Pagination & Polish) -- independent, can run anytime

Phase 4 (MCP Tool Cost Tracking, from finops roadmap) -- independent proxy work
```

Recommended order: 3A → 3B → 3C → 3D → Phase 4 (MCP) → Phase 5 (Perf).

---

## 5. Audit Findings

Items discovered during backend audits that should be tracked.

### Bugs to fix (Phase 3D)

- **Budgets GET route SQL injection risk:** `app/api/budgets/route.ts` uses
  raw SQL `IN ${keyIds}` instead of Drizzle's `inArray()`. Could produce
  invalid SQL for certain inputs.
- **`slack_configs` migration gap:** Drizzle schema has `slackUserId` column
  but the actual Postgres table does not. Every Settings page load triggers
  a 500 error on the Slack config API. Needs either a migration or schema
  correction.
- **Budget `currentPeriodStart` not initialized on creation:** `POST /api/budgets`
  sets `resetInterval` but never sets `currentPeriodStart`. It stays null,
  which means `computeDaysLeft()` on the Budgets page always returns null for
  real user-created budgets. Only the seed script sets this field. Fix: set
  `currentPeriodStart: sql\`NOW()\`` in both the insert values and the
  onConflictDoUpdate set clause when `resetInterval` is provided.
- ~~**Revoked API keys shown in budget create dropdown:**~~ **FALSE POSITIVE.**
  `GET /api/keys` already filters `isNull(apiKeys.revokedAt)` — revoked keys
  never appear in the dropdown. No fix needed.
- **`executing` status invisible in History:** `HISTORY_STATUSES` in
  `history/page.tsx` excludes `executing`, so actions mid-execution don't
  appear in the "All" tab.

### Data quality observations

- **`cost_events.userId` semantics:** This stores the proxied agent's user ID
  (from `x-agentseam-user-id` header), NOT the dashboard owner. Dashboard
  queries must join through `api_keys` to find the owner. The Phase 3A API
  design accounts for this.
- **Reasoning tokens not used in cost:** `reasoningTokens` are stored for
  transparency but are already included in `completion_tokens` and billed at
  the output rate. The UI should display them as a breakdown, not add them
  to the cost.
- **Google models priced but not proxied:** `gemini-2.5-pro` and
  `gemini-2.5-flash` have pricing data in the cost engine but the proxy only
  supports OpenAI. No action needed now, but the UI should be ready to
  display non-OpenAI providers when they ship.

### Future opportunities (not in current phases)

- **Budget denial log:** The 429 response body contains rich data
  (entity_key, remaining, estimated, limit, spent). Persisting these denials
  would let the UI show "X requests blocked this period" on the Budgets page.
- **Estimation accuracy:** The proxy estimates cost before each call and
  reconciles after. Comparing estimates to actuals over time could surface
  whether the 1.1x safety margin is appropriate.
- **Model pricing reference page:** The cost engine has pricing for 19 models.
  A simple "Pricing" page showing supported models and their rates would
  help users understand their costs.
- **Budget spend drift detection:** Budget spend is tracked in two parallel
  stores: Redis (atomic check-and-reserve) and Postgres
  `budgets.spendMicrodollars` (updated by `updateBudgetSpend`). Actual costs
  are in `cost_events`. If a reconciliation fails or the proxy reconciles
  with 0 on error paths, budget spend may diverge from the true sum of cost
  events. A periodic reconciliation job or a dashboard "audit" button that
  compares `budgets.spendMicrodollars` to `SUM(cost_events.costMicrodollars)`
  would detect and correct drift.
- **Action type API filter:** `GET /api/actions` only supports `status` as a
  filter parameter. Adding `actionType` filter would improve search at scale,
  especially once pagination is added (client-side search only works on the
  current page).

---

## 6. What's NOT in This Document

The following are mentioned in `finops-pivot-roadmap.md` but are explicitly
out of scope for these phases:

- Anthropic provider support (finops Phase 3 -- separate proxy work)
- MCP tool cost tracking (finops Phase 4 -- separate proxy work)
- Kill receipts (post-launch feature)
- Advanced budget policies (SOFT_CAP, CAP_MAX_TOKENS, DRAIN_MODE)
- Cost forecasting
- Team/org budget hierarchy
- Provider key vault
- Landing page and launch prep (finops Phase 6)

These are tracked in `docs/finops-pivot-roadmap.md` and will get their own
planning when prioritized.

---

## 7. Current State Summary

| Phase | Status | Next Action |
|---|---|---|
| Phase 0-2 (Proxy + Budget Enforcement) | **Complete** | -- |
| Phase 3A (Cost Events Visibility) | **Complete** | Activity page live at `/app/activity` |
| Phase 3B (Cost on Action Detail) | **Complete** | CostCard on action detail page, `actionId` correlation via proxy header |
| Phase 3C (Usage Analytics) | **Not started** | Blocked on 3A |
| Phase 3D (Pagination & Polish) | **Not started** | Can start anytime |
| Phase 4 (MCP Tool Cost Tracking) | **Not started** | After Phase 3; tracked in `finops-pivot-roadmap.md` |
| Phase 5 (Performance Monitoring) | **Not started** | After Phase 3C and Phase 4 |
