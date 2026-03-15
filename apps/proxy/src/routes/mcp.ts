import { waitUntil } from "cloudflare:workers";
import { Redis } from "@upstash/redis/cloudflare";
import { validatePlatformKey, unauthorizedResponse } from "../lib/auth.js";
import { extractAttribution } from "../lib/request-utils.js";
import { lookupBudgets, type BudgetEntity } from "../lib/budget-lookup.js";
import { checkAndReserve, type BudgetCheckResult } from "../lib/budget.js";
import { logCostEvent } from "../lib/cost-logger.js";
import { reconcileReservation } from "../lib/budget-reconcile.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// POST /v1/mcp/budget/check
// ---------------------------------------------------------------------------

interface BudgetCheckBody {
  toolName: string;
  serverName: string;
  estimateMicrodollars: number;
}

function validateBudgetCheckBody(
  body: Record<string, unknown>,
): BudgetCheckBody | null {
  if (
    typeof body.toolName !== "string" ||
    body.toolName.length === 0 ||
    typeof body.serverName !== "string" ||
    body.serverName.length === 0 ||
    typeof body.estimateMicrodollars !== "number" ||
    !Number.isFinite(body.estimateMicrodollars) ||
    body.estimateMicrodollars < 0
  ) {
    return null;
  }
  return body as unknown as BudgetCheckBody;
}

export async function handleMcpBudgetCheck(
  request: Request,
  env: Env,
  body: Record<string, unknown>,
): Promise<Response> {
  const isAuthed = await validatePlatformKey(
    request.headers.get("x-nullspend-auth"),
    env.PLATFORM_AUTH_KEY,
  );
  if (!isAuthed) return unauthorizedResponse();

  const parsed = validateBudgetCheckBody(body);
  if (!parsed) {
    return Response.json(
      {
        error: "bad_request",
        message:
          "Body must include toolName (string), serverName (string), estimateMicrodollars (non-negative number)",
      },
      { status: 400 },
    );
  }

  const userId = request.headers.get("x-nullspend-user-id");
  const keyId = request.headers.get("x-nullspend-key-id");

  const redis = Redis.fromEnv(env);
  const connectionString = env.HYPERDRIVE.connectionString;

  let budgetEntities: BudgetEntity[];
  try {
    budgetEntities = await lookupBudgets(redis, connectionString, keyId, userId);
  } catch {
    return Response.json(
      { error: "budget_unavailable", message: "Budget service unavailable" },
      { status: 503 },
    );
  }

  if (budgetEntities.length === 0) {
    return Response.json({ allowed: true });
  }

  const entityKeys = budgetEntities.map((e) => e.entityKey);

  let checkResult: BudgetCheckResult;
  try {
    checkResult = await checkAndReserve(
      redis,
      entityKeys,
      parsed.estimateMicrodollars,
    );
  } catch {
    return Response.json(
      { error: "budget_unavailable", message: "Budget service unavailable" },
      { status: 503 },
    );
  }

  if (checkResult.status === "denied") {
    return Response.json({
      allowed: false,
      denied: true,
      remaining: checkResult.remaining,
    });
  }

  return Response.json({
    allowed: true,
    reservationId: checkResult.reservationId,
  });
}

// ---------------------------------------------------------------------------
// POST /v1/mcp/events
// ---------------------------------------------------------------------------

interface McpCostEvent {
  toolName: string;
  serverName: string;
  durationMs: number;
  costMicrodollars: number;
  status: string;
  reservationId?: string;
  actionId?: string;
}

function validateEvents(body: Record<string, unknown>): McpCostEvent[] | null {
  if (!Array.isArray(body.events)) return null;
  if (body.events.length === 0 || body.events.length > 50) return null;

  for (const event of body.events) {
    if (
      typeof event !== "object" ||
      event === null ||
      typeof event.toolName !== "string" ||
      event.toolName.length === 0 ||
      typeof event.serverName !== "string" ||
      event.serverName.length === 0 ||
      typeof event.durationMs !== "number" ||
      !Number.isFinite(event.durationMs) ||
      event.durationMs < 0 ||
      typeof event.costMicrodollars !== "number" ||
      !Number.isFinite(event.costMicrodollars) ||
      event.costMicrodollars < 0 ||
      typeof event.status !== "string"
    ) {
      return null;
    }
  }

  return body.events as McpCostEvent[];
}

export async function handleMcpEvents(
  request: Request,
  env: Env,
  body: Record<string, unknown>,
): Promise<Response> {
  const isAuthed = await validatePlatformKey(
    request.headers.get("x-nullspend-auth"),
    env.PLATFORM_AUTH_KEY,
  );
  if (!isAuthed) return unauthorizedResponse();

  const events = validateEvents(body);
  if (!events) {
    return Response.json(
      {
        error: "bad_request",
        message: "Body must include events array (1-50 items) with toolName, serverName, durationMs, costMicrodollars, status",
      },
      { status: 400 },
    );
  }

  const attribution = extractAttribution(request);
  const connectionString = env.HYPERDRIVE.connectionString;

  // Validate UUID fields before DB insertion to prevent FK constraint failures
  const apiKeyId = attribution.apiKeyId && UUID_RE.test(attribution.apiKeyId)
    ? attribution.apiKeyId
    : null;

  const accepted = events.length;

  waitUntil(
    (async () => {
      const redis = Redis.fromEnv(env);

      for (const event of events) {
        try {
          const actionId = event.actionId && UUID_RE.test(event.actionId)
            ? event.actionId
            : null;

          await logCostEvent(connectionString, {
            requestId: crypto.randomUUID(),
            provider: "mcp",
            model: `${event.serverName}/${event.toolName}`,
            inputTokens: 0,
            outputTokens: 0,
            cachedInputTokens: 0,
            reasoningTokens: 0,
            costMicrodollars: event.costMicrodollars,
            durationMs: event.durationMs,
            userId: attribution.userId,
            apiKeyId,
            actionId,
          });

          // Reconcile reservation if one exists
          if (event.reservationId) {
            let budgetEntities: BudgetEntity[] = [];
            try {
              budgetEntities = await lookupBudgets(
                redis,
                connectionString,
                attribution.apiKeyId,
                attribution.userId,
              );
            } catch {
              // best-effort
            }
            if (budgetEntities.length > 0) {
              await reconcileReservation(
                redis,
                event.reservationId,
                event.costMicrodollars,
                budgetEntities,
                connectionString,
              );
            }
          }
        } catch (err) {
          console.error("[mcp-events] Failed to process event:", err);
        }
      }
    })(),
  );

  return Response.json({ accepted });
}
