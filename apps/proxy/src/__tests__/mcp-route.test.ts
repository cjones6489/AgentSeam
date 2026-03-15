import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";

// crypto.subtle.timingSafeEqual is a CF Workers API; polyfill for Node.js tests
beforeAll(() => {
  if (!crypto.subtle.timingSafeEqual) {
    (crypto.subtle as any).timingSafeEqual = (a: ArrayBuffer, b: ArrayBuffer) => {
      const viewA = new Uint8Array(a);
      const viewB = new Uint8Array(b);
      if (viewA.byteLength !== viewB.byteLength) return false;
      let result = 0;
      for (let i = 0; i < viewA.byteLength; i++) {
        result |= viewA[i] ^ viewB[i];
      }
      return result === 0;
    };
  }
});

vi.mock("cloudflare:workers", () => ({
  waitUntil: vi.fn((promise: Promise<unknown>) => {
    promise.catch(() => {});
  }),
}));

const mockLookupBudgets = vi.fn();
vi.mock("../lib/budget-lookup.js", () => ({
  lookupBudgets: (...args: unknown[]) => mockLookupBudgets(...args),
}));

const mockCheckAndReserve = vi.fn();
vi.mock("../lib/budget.js", () => ({
  checkAndReserve: (...args: unknown[]) => mockCheckAndReserve(...args),
}));

const mockLogCostEvent = vi.fn();
vi.mock("../lib/cost-logger.js", () => ({
  logCostEvent: (...args: unknown[]) => mockLogCostEvent(...args),
}));

const mockReconcileReservation = vi.fn();
vi.mock("../lib/budget-reconcile.js", () => ({
  reconcileReservation: (...args: unknown[]) => mockReconcileReservation(...args),
}));

vi.mock("@upstash/redis/cloudflare", () => ({
  Redis: { fromEnv: () => ({}) },
}));

import { handleMcpBudgetCheck, handleMcpEvents } from "../routes/mcp.js";

function makeRequest(
  path: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-NullSpend-Auth": "test-platform-key",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    PLATFORM_AUTH_KEY: "test-platform-key",
    HYPERDRIVE: {
      connectionString: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    },
    UPSTASH_REDIS_REST_URL: "https://fake.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "fake-token",
    ...overrides,
  } as Env;
}

describe("handleMcpBudgetCheck", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    mockLookupBudgets.mockReset();
    mockCheckAndReserve.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when auth header is missing", async () => {
    const request = makeRequest("/v1/mcp/budget/check", {
      toolName: "run_query",
      serverName: "supabase",
      estimateMicrodollars: 10000,
    }, { "X-NullSpend-Auth": "" });
    const env = makeEnv();

    const response = await handleMcpBudgetCheck(request, env, {
      toolName: "run_query",
      serverName: "supabase",
      estimateMicrodollars: 10000,
    });

    expect(response.status).toBe(401);
  });

  it("returns 401 when auth header is wrong", async () => {
    const request = makeRequest("/v1/mcp/budget/check", {}, {
      "X-NullSpend-Auth": "wrong-key",
    });
    const env = makeEnv();

    const response = await handleMcpBudgetCheck(request, env, {
      toolName: "run_query",
      serverName: "supabase",
      estimateMicrodollars: 10000,
    });

    expect(response.status).toBe(401);
  });

  it("returns 400 when body is missing toolName", async () => {
    const request = makeRequest("/v1/mcp/budget/check", {});
    const env = makeEnv();

    const response = await handleMcpBudgetCheck(request, env, {
      serverName: "supabase",
      estimateMicrodollars: 10000,
    });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("bad_request");
  });

  it("returns 400 when toolName is empty string", async () => {
    const request = makeRequest("/v1/mcp/budget/check", {});
    const env = makeEnv();

    const response = await handleMcpBudgetCheck(request, env, {
      toolName: "",
      serverName: "supabase",
      estimateMicrodollars: 10000,
    });

    expect(response.status).toBe(400);
  });

  it("returns 400 when serverName is empty string", async () => {
    const request = makeRequest("/v1/mcp/budget/check", {});
    const env = makeEnv();

    const response = await handleMcpBudgetCheck(request, env, {
      toolName: "run_query",
      serverName: "",
      estimateMicrodollars: 10000,
    });

    expect(response.status).toBe(400);
  });

  it("returns 400 when estimateMicrodollars is NaN", async () => {
    const request = makeRequest("/v1/mcp/budget/check", {});
    const env = makeEnv();

    const response = await handleMcpBudgetCheck(request, env, {
      toolName: "run_query",
      serverName: "supabase",
      estimateMicrodollars: NaN,
    });

    expect(response.status).toBe(400);
  });

  it("returns 400 when estimateMicrodollars is Infinity", async () => {
    const request = makeRequest("/v1/mcp/budget/check", {});
    const env = makeEnv();

    const response = await handleMcpBudgetCheck(request, env, {
      toolName: "run_query",
      serverName: "supabase",
      estimateMicrodollars: Infinity,
    });

    expect(response.status).toBe(400);
  });

  it("returns 400 when estimateMicrodollars is negative", async () => {
    const request = makeRequest("/v1/mcp/budget/check", {});
    const env = makeEnv();

    const response = await handleMcpBudgetCheck(request, env, {
      toolName: "run_query",
      serverName: "supabase",
      estimateMicrodollars: -100,
    });

    expect(response.status).toBe(400);
  });

  it("returns allowed: true when no budget entities exist", async () => {
    mockLookupBudgets.mockResolvedValue([]);

    const request = makeRequest("/v1/mcp/budget/check", {}, {
      "x-nullspend-user-id": "user-1",
      "x-nullspend-key-id": "key-1",
    });
    const env = makeEnv();

    const response = await handleMcpBudgetCheck(request, env, {
      toolName: "run_query",
      serverName: "supabase",
      estimateMicrodollars: 10000,
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.allowed).toBe(true);
  });

  it("returns allowed: true with reservationId when budget check passes", async () => {
    mockLookupBudgets.mockResolvedValue([
      {
        entityKey: "{budget}:user:user-1",
        entityType: "user",
        entityId: "user-1",
        maxBudget: 1_000_000,
        spend: 100_000,
        reserved: 0,
        policy: "strict_block",
      },
    ]);
    mockCheckAndReserve.mockResolvedValue({
      status: "approved",
      reservationId: "rsv-123",
    });

    const request = makeRequest("/v1/mcp/budget/check", {}, {
      "x-nullspend-user-id": "user-1",
      "x-nullspend-key-id": "key-1",
    });
    const env = makeEnv();

    const response = await handleMcpBudgetCheck(request, env, {
      toolName: "run_query",
      serverName: "supabase",
      estimateMicrodollars: 10000,
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.allowed).toBe(true);
    expect(json.reservationId).toBe("rsv-123");
  });

  it("returns denied when budget is exceeded", async () => {
    mockLookupBudgets.mockResolvedValue([
      {
        entityKey: "{budget}:user:user-1",
        entityType: "user",
        entityId: "user-1",
        maxBudget: 100,
        spend: 90,
        reserved: 0,
        policy: "strict_block",
      },
    ]);
    mockCheckAndReserve.mockResolvedValue({
      status: "denied",
      entityKey: "{budget}:user:user-1",
      remaining: 10,
      maxBudget: 100,
      spend: 90,
    });

    const request = makeRequest("/v1/mcp/budget/check", {}, {
      "x-nullspend-user-id": "user-1",
    });
    const env = makeEnv();

    const response = await handleMcpBudgetCheck(request, env, {
      toolName: "expensive_call",
      serverName: "github",
      estimateMicrodollars: 100000,
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.allowed).toBe(false);
    expect(json.denied).toBe(true);
    expect(json.remaining).toBe(10);
  });

  it("returns 503 when budget lookup fails", async () => {
    mockLookupBudgets.mockRejectedValue(new Error("Redis down"));

    const request = makeRequest("/v1/mcp/budget/check", {}, {
      "x-nullspend-user-id": "user-1",
    });
    const env = makeEnv();

    const response = await handleMcpBudgetCheck(request, env, {
      toolName: "run_query",
      serverName: "supabase",
      estimateMicrodollars: 10000,
    });

    expect(response.status).toBe(503);
    const json = await response.json();
    expect(json.error).toBe("budget_unavailable");
  });

  it("returns 503 when checkAndReserve fails", async () => {
    mockLookupBudgets.mockResolvedValue([
      {
        entityKey: "{budget}:user:user-1",
        entityType: "user",
        entityId: "user-1",
        maxBudget: 1_000_000,
        spend: 0,
        reserved: 0,
        policy: "strict_block",
      },
    ]);
    mockCheckAndReserve.mockRejectedValue(new Error("Lua script error"));

    const request = makeRequest("/v1/mcp/budget/check", {}, {
      "x-nullspend-user-id": "user-1",
    });
    const env = makeEnv();

    const response = await handleMcpBudgetCheck(request, env, {
      toolName: "run_query",
      serverName: "supabase",
      estimateMicrodollars: 10000,
    });

    expect(response.status).toBe(503);
  });

  it("passes userId and keyId from headers to lookupBudgets", async () => {
    mockLookupBudgets.mockResolvedValue([]);

    const request = makeRequest("/v1/mcp/budget/check", {}, {
      "x-nullspend-user-id": "user-abc",
      "x-nullspend-key-id": "key-xyz",
    });
    const env = makeEnv();

    await handleMcpBudgetCheck(request, env, {
      toolName: "t",
      serverName: "s",
      estimateMicrodollars: 0,
    });

    expect(mockLookupBudgets).toHaveBeenCalledWith(
      expect.anything(),
      env.HYPERDRIVE.connectionString,
      "key-xyz",
      "user-abc",
    );
  });
});

describe("handleMcpEvents", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    mockLogCostEvent.mockReset();
    mockReconcileReservation.mockReset();
    mockLookupBudgets.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when auth header is wrong", async () => {
    const request = makeRequest("/v1/mcp/events", {}, {
      "X-NullSpend-Auth": "wrong",
    });
    const env = makeEnv();

    const response = await handleMcpEvents(request, env, {
      events: [{ toolName: "t", serverName: "s", durationMs: 100, costMicrodollars: 10000, status: "success" }],
    });

    expect(response.status).toBe(401);
  });

  it("returns 400 when events array is missing", async () => {
    const request = makeRequest("/v1/mcp/events", {});
    const env = makeEnv();

    const response = await handleMcpEvents(request, env, {});

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("bad_request");
  });

  it("returns 400 when events array is empty", async () => {
    const request = makeRequest("/v1/mcp/events", {});
    const env = makeEnv();

    const response = await handleMcpEvents(request, env, { events: [] });

    expect(response.status).toBe(400);
  });

  it("returns 400 when events exceed 50", async () => {
    const request = makeRequest("/v1/mcp/events", {});
    const env = makeEnv();

    const events = Array.from({ length: 51 }, (_, i) => ({
      toolName: `t${i}`,
      serverName: "s",
      durationMs: 100,
      costMicrodollars: 10000,
      status: "success",
    }));

    const response = await handleMcpEvents(request, env, { events });

    expect(response.status).toBe(400);
  });

  it("returns 400 when event has empty toolName", async () => {
    const request = makeRequest("/v1/mcp/events", {});
    const env = makeEnv();

    const response = await handleMcpEvents(request, env, {
      events: [{ toolName: "", serverName: "s", durationMs: 100, costMicrodollars: 10000, status: "success" }],
    });

    expect(response.status).toBe(400);
  });

  it("returns 400 when event has empty serverName", async () => {
    const request = makeRequest("/v1/mcp/events", {});
    const env = makeEnv();

    const response = await handleMcpEvents(request, env, {
      events: [{ toolName: "t", serverName: "", durationMs: 100, costMicrodollars: 10000, status: "success" }],
    });

    expect(response.status).toBe(400);
  });

  it("returns 400 when event durationMs is NaN", async () => {
    const request = makeRequest("/v1/mcp/events", {});
    const env = makeEnv();

    const response = await handleMcpEvents(request, env, {
      events: [{ toolName: "t", serverName: "s", durationMs: NaN, costMicrodollars: 10000, status: "success" }],
    });

    expect(response.status).toBe(400);
  });

  it("returns 400 when event costMicrodollars is negative", async () => {
    const request = makeRequest("/v1/mcp/events", {});
    const env = makeEnv();

    const response = await handleMcpEvents(request, env, {
      events: [{ toolName: "t", serverName: "s", durationMs: 100, costMicrodollars: -1, status: "success" }],
    });

    expect(response.status).toBe(400);
  });

  it("returns 400 when event durationMs is Infinity", async () => {
    const request = makeRequest("/v1/mcp/events", {});
    const env = makeEnv();

    const response = await handleMcpEvents(request, env, {
      events: [{ toolName: "t", serverName: "s", durationMs: Infinity, costMicrodollars: 10000, status: "success" }],
    });

    expect(response.status).toBe(400);
  });

  it("returns 400 when event is missing required fields", async () => {
    const request = makeRequest("/v1/mcp/events", {});
    const env = makeEnv();

    const response = await handleMcpEvents(request, env, {
      events: [{ toolName: "t" }],
    });

    expect(response.status).toBe(400);
  });

  it("returns accepted count for valid events", async () => {
    mockLogCostEvent.mockResolvedValue(undefined);

    const request = makeRequest("/v1/mcp/events", {}, {
      "x-nullspend-user-id": "user-1",
      "x-nullspend-key-id": "key-1",
    });
    const env = makeEnv();

    const events = [
      { toolName: "run_query", serverName: "supabase", durationMs: 150, costMicrodollars: 10000, status: "success" },
      { toolName: "list_files", serverName: "github", durationMs: 200, costMicrodollars: 10000, status: "success" },
    ];

    const response = await handleMcpEvents(request, env, { events });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.accepted).toBe(2);
  });

  it("maps events to cost_events with provider=mcp and model=server/tool", async () => {
    mockLogCostEvent.mockResolvedValue(undefined);

    const request = makeRequest("/v1/mcp/events", {}, {
      "x-nullspend-user-id": "user-1",
      "x-nullspend-key-id": "550e8400-e29b-41d4-a716-446655440000",
    });
    const env = makeEnv();

    const events = [
      { toolName: "run_query", serverName: "supabase", durationMs: 150, costMicrodollars: 10000, status: "success" },
    ];

    await handleMcpEvents(request, env, { events });

    // waitUntil fires the promise; since it's mocked synchronously we can check
    // Give the microtask a tick
    await new Promise((r) => setTimeout(r, 10));

    expect(mockLogCostEvent).toHaveBeenCalledWith(
      env.HYPERDRIVE.connectionString,
      expect.objectContaining({
        provider: "mcp",
        model: "supabase/run_query",
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
        reasoningTokens: 0,
        costMicrodollars: 10000,
        durationMs: 150,
        userId: "user-1",
        apiKeyId: "550e8400-e29b-41d4-a716-446655440000",
      }),
    );
  });

  it("nulls out invalid apiKeyId to prevent FK constraint failure", async () => {
    mockLogCostEvent.mockResolvedValue(undefined);

    const request = makeRequest("/v1/mcp/events", {}, {
      "x-nullspend-user-id": "user-1",
      "x-nullspend-key-id": "not-a-uuid",
    });
    const env = makeEnv();

    const events = [
      { toolName: "t", serverName: "s", durationMs: 100, costMicrodollars: 10000, status: "success" },
    ];

    await handleMcpEvents(request, env, { events });
    await new Promise((r) => setTimeout(r, 10));

    expect(mockLogCostEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ apiKeyId: null }),
    );
  });

  it("nulls out invalid actionId to prevent FK constraint failure", async () => {
    mockLogCostEvent.mockResolvedValue(undefined);

    const request = makeRequest("/v1/mcp/events", {});
    const env = makeEnv();

    const events = [
      {
        toolName: "t",
        serverName: "s",
        durationMs: 100,
        costMicrodollars: 5000,
        status: "success",
        actionId: "not-a-uuid",
      },
    ];

    await handleMcpEvents(request, env, { events });
    await new Promise((r) => setTimeout(r, 10));

    expect(mockLogCostEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actionId: null }),
    );
  });

  it("preserves valid UUID actionId", async () => {
    mockLogCostEvent.mockResolvedValue(undefined);

    const request = makeRequest("/v1/mcp/events", {});
    const env = makeEnv();

    const events = [
      {
        toolName: "t",
        serverName: "s",
        durationMs: 100,
        costMicrodollars: 5000,
        status: "success",
        actionId: "550e8400-e29b-41d4-a716-446655440000",
      },
    ];

    await handleMcpEvents(request, env, { events });
    await new Promise((r) => setTimeout(r, 10));

    expect(mockLogCostEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actionId: "550e8400-e29b-41d4-a716-446655440000" }),
    );
  });

  it("reconciles reservation when reservationId is present", async () => {
    mockLogCostEvent.mockResolvedValue(undefined);
    mockLookupBudgets.mockResolvedValue([
      {
        entityKey: "{budget}:user:user-1",
        entityType: "user",
        entityId: "user-1",
        maxBudget: 1_000_000,
        spend: 0,
        reserved: 10000,
        policy: "strict_block",
      },
    ]);
    mockReconcileReservation.mockResolvedValue(undefined);

    const request = makeRequest("/v1/mcp/events", {}, {
      "x-nullspend-user-id": "user-1",
      "x-nullspend-key-id": "550e8400-e29b-41d4-a716-446655440000",
    });
    const env = makeEnv();

    const events = [
      {
        toolName: "run_query",
        serverName: "supabase",
        durationMs: 150,
        costMicrodollars: 10000,
        status: "success",
        reservationId: "rsv-123",
      },
    ];

    await handleMcpEvents(request, env, { events });
    await new Promise((r) => setTimeout(r, 10));

    expect(mockReconcileReservation).toHaveBeenCalledWith(
      expect.anything(),
      "rsv-123",
      10000,
      expect.arrayContaining([
        expect.objectContaining({ entityKey: "{budget}:user:user-1" }),
      ]),
      env.HYPERDRIVE.connectionString,
    );
  });

  it("does not throw when logCostEvent fails", async () => {
    mockLogCostEvent.mockRejectedValue(new Error("DB down"));

    const request = makeRequest("/v1/mcp/events", {});
    const env = makeEnv();

    const events = [
      { toolName: "t", serverName: "s", durationMs: 100, costMicrodollars: 10000, status: "success" },
    ];

    const response = await handleMcpEvents(request, env, { events });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.accepted).toBe(1);
  });

  it("accepts events with valid UUID actionId", async () => {
    mockLogCostEvent.mockResolvedValue(undefined);

    const request = makeRequest("/v1/mcp/events", {});
    const env = makeEnv();

    const events = [
      {
        toolName: "t",
        serverName: "s",
        durationMs: 100,
        costMicrodollars: 5000,
        status: "success",
        actionId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      },
    ];

    await handleMcpEvents(request, env, { events });
    await new Promise((r) => setTimeout(r, 10));

    expect(mockLogCostEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actionId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }),
    );
  });
});
