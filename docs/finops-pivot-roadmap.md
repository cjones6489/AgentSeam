# AgentSeam FinOps Pivot: Build Roadmap

> **Status: Active.** This is the master roadmap for the AgentSeam pivot from
> approval layer to trust-first AI agent FinOps proxy.
>
> **How to use this document:** Each phase has scope, acceptance criteria, and
> references to the technical build spec. When we start a phase, we create a
> detailed implementation plan for that phase using the referenced sections.
> We do not build ahead of the current phase.
>
> **Reference documents:**
> - `docs/claude-research/compass_artifact_wf-4db73083-*` — Competitive landscape
> - `docs/claude-research/compass_artifact_wf-40b71591-*` — Technical build spec

---

## The #1 Rule: Developer simplicity above everything

The developer experience is ONE thing: **change your base URL.**

```bash
# Before
OPENAI_BASE_URL=https://api.openai.com/v1

# After
OPENAI_BASE_URL=https://proxy.agentseam.com/v1
```

That's it. Their existing code, existing SDK, existing streaming — all works
identically. No package to install, no client to wrap, no decorators, no
config files. One environment variable and they have cost tracking + budget
enforcement.

For MCP, same idea — one config line change to point at our proxy instead of
the real server.

**All complexity is OUR complexity, not the developer's.** The Anthropic cache
token math, the Redis Lua scripts, the streaming parser edge cases — all lives
behind the proxy. The developer never sees it. They see: "my agent costs $4.72
today, it's used 47% of its $10 budget."

**The complexity trap to avoid:** LiteLLM requires Docker + PostgreSQL + Redis +
YAML config. That's why developers complain about it despite 38K stars. If
setting up AgentSeam ever requires more than an API key and a base URL change,
we've gone wrong.

**V1 surface area (four things):**
1. Change your base URL
2. See your costs in a dashboard
3. Set a budget
4. Get blocked when you exceed it

Everything else — kill receipts, BATS-style budget injection, cost forecasting,
team hierarchies, tool cost registries — is post-launch. The research docs are
a roadmap, not a sprint.

---

## Product vision (one sentence)

AgentSeam is the FinOps layer for AI agents — a proxy that tracks every dollar
your agents spend on LLM tokens and tool calls, enforces hard budget ceilings,
and gives you the receipts to prove it.

## Positioning

| What we are | What we are not |
|---|---|
| One env var change, instant cost visibility | Install a package, wrap your client, add decorators |
| Hard budget enforcement in a hosted product | Soft alerts that nobody acts on |
| $49–99/month, zero infrastructure | Docker + Postgres + Redis + YAML config |
| Transparent proxy (zero code changes) | SDK that requires rewriting your agent |
| Identity-based enforcement (no bypass bugs) | Route-based enforcement (LiteLLM's flaw) |

## Competitive wedge

No hosted product under $500/month offers real budget enforcement with unified
LLM + tool call cost tracking. LiteLLM has budget enforcement but it's buggy
and requires self-hosting. Portkey only enforces at Enterprise tier. We offer
it at $49/month with a one-line setup.

## Architecture overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Developer / Agent                           │
│  Uses OpenAI/Anthropic SDK with base URL pointed at AgentSeam  │
│  OR connects MCP client through AgentSeam MCP proxy            │
└────────────┬──────────────────────────────┬─────────────────────┘
             │ LLM API calls               │ MCP tool calls
             ▼                             ▼
┌────────────────────────┐    ┌──────────────────────────┐
│  LLM Proxy             │    │  MCP Cost Proxy          │
│  (Cloudflare Workers)  │    │  (stdio / HTTP)          │
│  Stream → tee → log    │    │  Intercept tools/call    │
│  Budget check (Redis)  │    │  Track cost + duration   │
│  Cost calc per provider│    │  Budget enforcement      │
└────────┬───────────────┘    └────────┬─────────────────┘
         │                             │
         ▼                             ▼
┌──────────────────────────────────────────────────────────────┐
│                    Shared Infrastructure                      │
│  Upstash Redis — atomic budget state (Lua scripts)           │
│  Supabase Postgres — ledger, config, budgets, auth           │
│  (Future: ClickHouse for analytics at scale)                 │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                    Dashboard (Next.js / Vercel)               │
│  Cost overview · Per-agent breakdown · Budget management      │
│  Kill receipts · Settings · API keys                          │
└──────────────────────────────────────────────────────────────┘
```

## Providers in scope (launch)

- **OpenAI** — GPT-5, GPT-4.1, GPT-4o, o3, o4-mini (Phase 1)
- **Anthropic** — Claude Sonnet 4.6, Opus 4.6, Haiku 4.5 (Phase 3)

Post-launch based on demand: Gemini, Bedrock, Azure OpenAI.

---

## Phase 0: Foundation & Repo Restructure

**Goal:** Set up the new infrastructure so every subsequent phase has a place to land.

### Scope

1. **Create the Cloudflare Workers project** at `apps/proxy/`
   - Wrangler config, TypeScript, local dev with `wrangler dev`
   - Basic "hello world" Worker that accepts a request and returns a response
   - CI: `pnpm proxy:dev`, `pnpm proxy:deploy`

2. **Set up Upstash Redis**
   - Create Upstash Redis instance
   - Add `@upstash/redis` dependency to the proxy
   - Verify connectivity from CF Worker (REST-based, not TCP)
   - Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to env

3. **Restructure the monorepo**
   - Move existing Next.js app to `apps/dashboard/` (or keep at root — decide)
   - Create `packages/cost-engine/` for provider parsers and pricing logic
   - Create `packages/shared/` for types shared between proxy and dashboard
   - Update workspace config in `pnpm-workspace.yaml`

4. **New database tables** (Drizzle schema additions)
   - `budgets` — entity_type, entity_id, max_budget, spend, reset_interval, policy, reset_at
   - `cost_events` — append-only ledger: request_id, provider, model, input_tokens, output_tokens, cached_tokens, reasoning_tokens, cost_microdollars, entity attributions, timestamp
   - `tool_costs` — registered tool cost definitions (name, estimated_cost, provider)
   - Keep existing `api_keys` table (reusable as-is)

5. **Model pricing database**
   - Import LiteLLM's `model_prices_and_context_window.json` as seed data
   - Create a typed lookup function: `getModelPricing(provider, model) → PricingConfig`
   - Store in a JSON file in `packages/cost-engine/` for now (DB-backed later)

### Acceptance criteria

- `wrangler dev` starts locally and responds to HTTP requests
- Redis connection works from the Worker
- `pnpm build` still succeeds for the dashboard
- New DB tables can be pushed with `pnpm db:push`
- `getModelPricing("openai", "gpt-4o")` returns correct rates

### Tech spec references

- §4: Proxy architecture patterns (Cloudflare Workers setup)
- §5: Budget state storage architecture (Redis + Postgres roles)
- §6: Model pricing databases (LiteLLM JSON format)
- §7: Trust architecture principles

---

## Phase 1: OpenAI Streaming Proxy

**Goal:** A working proxy that intercepts OpenAI API calls, streams responses
back to the client transparently, extracts usage data, and calculates cost
accurately.

### Scope

1. **Request interception**
   - Accept `POST /v1/chat/completions` at the proxy
   - Authenticate via `X-AgentSeam-Auth` header (platform key)
   - Pass through `Authorization` header to OpenAI (BYOK mode)
   - Inject `stream: true` and `stream_options: { include_usage: true }` if not present

2. **Stream proxying**
   - Forward request to `https://api.openai.com/v1/chat/completions`
   - Use `response.body.tee()` to split: one leg to client, one for processing
   - Client receives the stream with zero modification
   - `ctx.waitUntil()` for async log processing (never block the response)
   - `ctx.passThroughOnException()` for automatic failover

3. **Usage extraction from streaming responses**
   - Parse SSE chunks: lines starting with `data: `, skip `data: [DONE]`
   - Extract `usage` from the final chunk (empty `choices` array)
   - Handle both Chat Completions and Responses API field names

4. **Cost calculation engine** (`packages/cost-engine/`)
   - OpenAI cost formula:
     ```
     cost = (prompt_tokens - cached_tokens) × input_rate
          + cached_tokens × cached_input_rate
          + completion_tokens × output_rate
     ```
   - Handle `reasoning_tokens` (subset of `completion_tokens`, billed at output rate)
   - Handle `cached_tokens` (subset of `prompt_tokens`)
   - Use microdollars (integers) for all cost math — no floating point

5. **Cost event logging**
   - After cost is calculated, log to Postgres `cost_events` table
   - Include: provider, model, all token counts, cost, request metadata
   - Async via `ctx.waitUntil()` — never block the response

6. **Non-streaming support**
   - If request has `stream: false` or no `stream` field, handle synchronous response
   - Extract `usage` from the response body JSON directly
   - Same cost calculation and logging

### Acceptance criteria

- `curl` to the proxy with an OpenAI API key streams a response identically to hitting OpenAI directly
- Usage data is correctly extracted from both streaming and non-streaming responses
- Cost is calculated correctly for GPT-5, GPT-4o, o3, o4-mini (verify against manual calculation)
- `cost_events` table has a row for every proxied request
- If the proxy throws, the request falls through to OpenAI (passThroughOnException)

### Test cases

- Streaming response with cached tokens
- Streaming response with reasoning tokens (o3/o4-mini)
- Non-streaming response
- Request with no `stream_options` (proxy should inject)
- Large streaming response (verify no buffering, stays under 128MB)
- Proxy error (verify passthrough to OpenAI)

### Tech spec references

- §1: OpenAI Chat Completions API usage object
- §1: Streaming usage data handling (OpenAI section)
- §1: Reasoning tokens
- §1: Current pricing reference table
- §4: Streaming proxy pattern (code example)
- §4: Helicone's Cloudflare Workers architecture

---

## Phase 2: Budget Enforcement (Redis)

**Goal:** Atomic budget check-and-reserve that blocks requests when spend
exceeds limits, with zero bypass vulnerabilities.

### Scope

1. **Redis Lua budget script**
   - Implement the atomic check-and-reserve script from the tech spec
   - Budget stored in microdollars for integer precision
   - Reservation with TTL (auto-expire if response never comes back)
   - Clean expired reservations on every check

2. **Pre-request budget check**
   - Before forwarding to OpenAI, estimate max cost:
     ```
     estimated = input_tokens × input_rate + max_tokens × output_rate × 1.1
     ```
   - For pre-request token estimation: use the `max_tokens` from the request
     as the upper bound for output cost (conservative but safe)
   - Call Redis Lua script atomically
   - If budget exceeded: return HTTP 429 with clear error message and remaining budget info
   - If approved: forward request with reservation ID

3. **Post-response budget reconciliation**
   - After response completes, calculate actual cost from usage data
   - Release the reservation and debit the actual cost
   - If actual > estimated, debit the difference
   - If actual < estimated, credit the difference back to remaining budget

4. **Budget enforcement hierarchy**
   - Check ALL entities independently, enforce most restrictive:
     - Key budget (from `api_keys` + `budgets` join)
     - User budget (always checked, regardless of team)
   - (Team and org budgets are post-launch scope)

5. **Budget policy (V1: STRICT_BLOCK only)**
   - Block the request if estimated max cost > remaining budget
   - Return HTTP 429 with: reason, remaining budget, estimated cost
   - Advanced policies (SOFT_CAP, CAP_MAX_TOKENS, DRAIN_MODE) are post-launch

6. **Budget CRUD API**
   - `POST /api/budgets` — create/update budget for a key or user
   - `GET /api/budgets` — list budgets with current spend
   - `DELETE /api/budgets/:id` — remove a budget
   - `POST /api/budgets/:id/reset` — manual reset

### Acceptance criteria

- Concurrent requests cannot collectively exceed budget (no race condition)
- A request that would exceed budget returns 429 with useful error
- After budget is exhausted, all subsequent requests are blocked
- Budget survives proxy restarts (Redis-backed)
- Manual budget reset works
- Reservations auto-expire after TTL

### Test cases

- 10 concurrent requests against a $1 budget — total spend should not exceed $1 + one request's cost
- Budget exhausted → 429 response with clear error message
- Reservation TTL expiry (simulate failed response)
- Budget reset (manual)
- No budget set → proxy passes through without enforcement

### Tech spec references

- §5: The hybrid pre-request + post-response pattern
- §5: Atomic budget check-and-reserve (Redis Lua script — full code)
- §5: The "last request" problem — configurable policies
- §5: Budget enforcement hierarchy
- §5: Streaming budget enforcement
- §2: All 5 LiteLLM budget enforcement bugs (anti-patterns to avoid)
- §2: Architectural patterns to avoid

---

## Phase 3: Anthropic Provider Support

**Goal:** Add Anthropic as the second provider, handling the cache token math
that has tripped up every competitor.

### Scope

1. **Request interception for Anthropic**
   - Accept `POST /v1/messages` at the proxy
   - Forward to `https://api.anthropic.com/v1/messages`
   - Pass through `x-api-key` and `anthropic-version` headers

2. **Anthropic-specific streaming parsing**
   - Input tokens arrive in `message_start` event
   - Output tokens arrive in `message_delta` event (cumulative, not incremental)
   - **Critical rule:** Use ONLY `message_start` for input, ONLY final `message_delta` for output
   - Never sum across events (this is the root cause of double-counting bugs)

3. **Anthropic cost calculation**
   - `input_tokens` = uncached tokens only (NOT total — opposite of OpenAI)
   - Total input = `input_tokens` + `cache_creation_input_tokens` + `cache_read_input_tokens`
   - Cost formula:
     ```
     cost = input_tokens × base_rate
          + cache_creation × (1.25 × base_rate)     // 5-min TTL
          + cache_read × (0.1 × base_rate)           // 90% discount
          + output_tokens × output_rate
     ```
   - Handle 1-hour TTL cache writes (2.0× multiplier)
   - Handle the `cache_creation` sub-object with `ephemeral_5m` and `ephemeral_1h` breakdowns
   - Handle long context (>200K input) rate doubling

4. **Extended thinking tokens**
   - Anthropic thinking produces visible `{"type": "thinking"}` content blocks
   - Billed as output tokens (already in `output_tokens`)
   - No special handling needed for cost — just ensure we don't double-count

5. **Non-streaming Anthropic support**
   - Extract usage from response JSON directly
   - Same cost formula

### Acceptance criteria

- Anthropic streaming responses proxy correctly with zero modification
- Cache token costs are calculated accurately (no double-counting)
- Cost matches manual calculation for: Sonnet 4.6, Opus 4.6, Haiku 4.5
- Extended thinking responses are handled correctly
- Both 5-min and 1-hour cache TTLs produce correct costs
- Budget enforcement works identically to OpenAI (same Redis path)

### Test cases (derived from real bugs)

- Langfuse #12306 scenario: verify cache tokens are not double-added
- LangChain #10249 scenario: streaming with cache counts in both events — verify no double-counting
- LiteLLM #5443 scenario: verify cache read/write costs are included, not just input_tokens
- LiteLLM #6575 scenario: verify cache write cost uses correct formula
- Cline #4346 scenario: verify cumulative message_delta is not treated as incremental
- Response with both ephemeral_5m and ephemeral_1h cache writes

### Tech spec references

- §1: Anthropic Messages API usage object
- §1: Streaming usage data handling (Anthropic section)
- §1: Cache token double-counting bugs to avoid (all 5 bugs)
- §1: Current pricing reference table (Claude models)

---

## Phase 4: MCP Tool Cost Proxy

**Goal:** Adapt the existing MCP proxy to track tool call costs and enforce
budgets. Same developer simplicity: one config line change.

> **Simplicity check:** Developer changes one line in their MCP client config
> to point at AgentSeam's proxy instead of the real server. That's it.

### Scope

1. **Strip the approval loop from the MCP proxy**
   - Remove `gateToolCall` (polls for human decision)
   - Replace with: check budget → forward call → track cost → update budget
   - Keep `discoverUpstreamTools`, `forwardToUpstream`, config patterns

2. **Tool call tracking**
   - Time every `tools/call` invocation (start → response)
   - Record: tool name, duration_ms, cost (if known)
   - Log to `cost_events` with `provider: "mcp"` and `model: tool_name`
   - V1: track calls and duration only. Tool cost configuration is post-launch.

3. **Shared budget enforcement**
   - Same Redis Lua script as LLM proxy
   - MCP tool calls and LLM calls share the same budget pool
   - If budget exceeded: return MCP error result (not JSON-RPC error)

4. **Unified cost view**
   - Both LLM proxy and MCP proxy write to the same `cost_events` table
   - Dashboard shows LLM costs and tool calls together

### NOT in V1 scope (post-launch)

- Tool cost registration API (per-tool pricing configuration)
- Duration-based cost estimation
- Dashboard UI for managing tool costs

### Acceptance criteria

- MCP tool calls are tracked with duration in the cost events ledger
- Budget enforcement blocks tool calls when budget is exceeded
- Cost events appear alongside LLM costs in the same dashboard
- Developer setup is one config line change

### Tech spec references

- §3: MCP protocol details for proxy interception
- §3: JSON-RPC message formats
- §3: Transport layers and interception strategies
- §3: Proxy architecture pattern

---

## Phase 5: Dashboard & API

**Goal:** A minimal dashboard that answers "what are my agents costing me?"
and lets users set budgets. Nothing more for V1.

> **Simplicity check:** The dashboard serves two purposes: (1) see your costs,
> (2) set a budget. If a feature doesn't serve one of those, it's post-launch.

### Scope

1. **Cost overview page**
   - Total spend (today, this week, this month)
   - Breakdown by: provider, model, API key
   - Simple table or bar chart — no need for fancy analytics in V1

2. **Budget management page**
   - Create a budget for an API key (amount + reset interval)
   - See current spend vs limit (progress bar)
   - Default policy: `STRICT_BLOCK`
   - Edit / delete / reset a budget

3. **Cost events log**
   - Paginated table of recent cost events
   - Filter by: provider, model, date range
   - Shows: timestamp, model, tokens, cost

4. **Settings page (evolve existing)**
   - Keep API key management from current app
   - Show proxy base URL for each provider ("point your OpenAI SDK here")
   - Copy-paste setup instructions

5. **API endpoints**
   - `GET /api/costs/summary` — aggregated cost data
   - `GET /api/costs/events` — paginated cost event log
   - `POST/GET/DELETE /api/budgets` — budget CRUD

### NOT in V1 scope (post-launch)

- Kill receipts (post-launch — complete whitespace, great differentiator, but not V1)
- Per-agent breakdown charts
- Cost forecasting
- Alert thresholds / Slack notifications
- Provider key vault configuration
- Advanced budget policies (SOFT_CAP, CAP_MAX_TOKENS) — V1 ships STRICT_BLOCK only

### Acceptance criteria

- Dashboard loads with real cost data from proxied requests
- User can create a budget and see current spend vs limit
- Cost event log shows every proxied request with accurate cost
- Settings page shows the proxy URL and API key setup instructions
- A developer can go from sign-up to seeing costs in under 5 minutes

### Tech spec references

- §5: Budget enforcement hierarchy (for budget management UI)
- §7: Trust architecture principles (for settings/security)

---

## Phase 6: Launch Prep

**Goal:** Everything needed to put this in front of developers.

### Scope

1. **Landing page**
   - Clear value prop: "Know what your AI agents cost. Set hard budgets."
   - Hero shows the one-line setup (change your base URL)
   - Interactive demo showing cost tracking in action
   - Pricing page (free tier + paid)

2. **Documentation**
   - Quickstart: "Add AgentSeam in 60 seconds" (base URL change)
   - Provider setup guides (OpenAI, Anthropic)
   - MCP proxy setup guide
   - Budget configuration guide
   - API reference

3. **Open source prep**
   - License the proxy as Apache 2.0
   - Clean up the repo for public consumption
   - Write a compelling README with the $47K horror story hook
   - GitHub Actions CI

4. **HN launch post**
   - Title: "Show HN: AgentSeam – FinOps for AI agents (budget enforcement that actually works)"
   - Lead with the problem ($47K recursive loop, $764 LiteLLM budget bypass)
   - Show the 5 gaps and how AgentSeam fills them
   - Link to live demo, GitHub, docs

5. **Pricing**
   - Free tier: 10K requests/month, 1 budget, basic dashboard
   - Pro ($49/month): unlimited requests, unlimited budgets, kill receipts, Slack alerts
   - Team ($99/month): team budgets, advanced analytics, priority support

### Acceptance criteria

- A developer can sign up, point their OpenAI base URL at AgentSeam, and see costs within 5 minutes
- Landing page clearly communicates value
- HN post is ready to submit
- Free tier works without credit card

---

## Post-Launch Roadmap (prioritize based on user demand)

### Near-term (add based on early user feedback)

- **Kill receipts** (Gap 3): human-readable post-mortems when requests are blocked.
  Complete whitespace — no competitor does this. Strong differentiator.
- **Advanced budget policies**: SOFT_CAP, CAP_MAX_TOKENS, DRAIN_MODE
- **Slack/webhook alerts**: notify on budget thresholds (50%, 80%, 100%)
- **Tool cost registration**: let users configure per-tool costs for MCP tracking
- **Per-agent breakdown**: attribute costs to specific agents/workflows

### Additional providers

- Google Gemini (§1: usageMetadata format, thoughtsTokenCount)
- AWS Bedrock (§1: camelCase fields, Converse API)
- Azure OpenAI (§1: null vs 0, Provisioned deployment discounts)

### Longer-term

- **Agent unit economics** (Gap 4): cost per successful task, quality-adjusted metrics
- **Cost forecasting** (Gap 5): model agent workflow cost patterns for prediction
- **BATS-style budget injection** (§8): inject remaining budget into system prompts
- **Vault mode**: encrypted provider key storage (XChaCha20)
- **Team/org budget hierarchy**: multi-level budget enforcement
- **Pre-request token estimation**: tiktoken for OpenAI, server-side count_tokens for Anthropic
- **Self-hosted deployment**: Docker Compose + Helm charts

---

## Decisions log

| Decision | Choice | Rationale |
|---|---|---|
| Proxy runtime | Cloudflare Workers | <1ms cold start, 100MB body limit, waitUntil, passThroughOnException. Vercel's 5MB limit is disqualifying. |
| Budget state store | Upstash Redis | REST-based (works from CF Workers), atomic Lua scripts, no TCP required |
| Cost precision | Microdollars (integers) | Avoids floating point errors in financial calculations |
| Launch providers | OpenAI + Anthropic only | Covers vast majority of agent developers. Add others post-launch based on demand. |
| Auth model | BYOK (pass-through) first | Provider keys never stored. Lowest friction. Vault mode is post-launch. |
| Dashboard hosting | Vercel (existing) | Keep the Next.js app where it is. Dashboard ≠ proxy — different latency requirements. |
| License | Apache 2.0 (proxy), proprietary (dashboard SaaS) | Following Helicone's model. Max adoption for proxy, monetize via dashboard. |
| Existing approval code | Preserve but deprioritize | Don't delete — may become a feature within FinOps. But don't invest in it now. |

---

## What carries over from the current codebase

| Asset | Reusable? | Notes |
|---|---|---|
| Dashboard shell (layout, sidebar, auth) | Yes | Same auth flow, same navigation pattern |
| shadcn/ui components | Yes | All UI primitives carry over |
| Auth logic (session, API keys, Supabase) | Yes | API key model is reusable as-is |
| Drizzle ORM setup | Yes | Add new tables, keep existing |
| Error handling patterns | Yes | Same HTTP error utilities |
| MCP proxy structure | Partial | Keep transport/config, replace gate logic |
| TanStack Query patterns | Yes | Same data fetching approach, new queries |
| Action lifecycle code | No | Preserved but not used in FinOps flow |
| Slack integration | Partial | Adapt for budget alerts instead of approval notifications |
| Test infrastructure (Vitest) | Yes | Same framework, new test cases |
