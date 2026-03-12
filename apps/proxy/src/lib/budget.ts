import type { Redis } from "@upstash/redis/cloudflare";

const RESERVATION_TTL_SECONDS = 180;

// ---------------------------------------------------------------------------
// Lua Scripts
// ---------------------------------------------------------------------------

/**
 * Script A: checkAndReserve
 *
 * KEYS: entity budget hashes (1..n), e.g. {budget}:api_key:{id}
 * ARGV: [estimatedCostMicrodollars, reservationId, reservationTTLSeconds, reservationKey]
 *
 * Phase 1 – read-only check against every entity.
 * Phase 2 – if all pass, atomically reserve on every entity and persist a
 *           reservation reference key with TTL for crash-recovery.
 */
const CHECK_AND_RESERVE_LUA = `
local estimate = tonumber(ARGV[1])
local rsvId = ARGV[2]
local rsvTTL = tonumber(ARGV[3])
local rsvKey = ARGV[4]

for i = 1, #KEYS do
  local maxBudget = tonumber(redis.call('HGET', KEYS[i], 'maxBudget') or '0')
  local spend = tonumber(redis.call('HGET', KEYS[i], 'spend') or '0')
  local reserved = tonumber(redis.call('HGET', KEYS[i], 'reserved') or '0')
  if spend + reserved + estimate > maxBudget then
    return cjson.encode({
      status = 'denied',
      entityKey = KEYS[i],
      remaining = maxBudget - spend - reserved,
      maxBudget = maxBudget,
      spend = spend
    })
  end
end

local rsvData = {}
for i = 1, #KEYS do
  redis.call('HINCRBY', KEYS[i], 'reserved', estimate)
  rsvData[#rsvData + 1] = KEYS[i]
end

local rsvValue = cjson.encode({keys = rsvData, estimate = estimate})
redis.call('SET', rsvKey, rsvValue, 'EX', rsvTTL)

return cjson.encode({status = 'approved', reservationId = rsvId})
`;

/**
 * Script B: reconcile (Fix 7 – reserved clamping, Fix 14 – declared entity keys)
 *
 * KEYS: [{budget}:rsv:{reservationId}, ...entityKeys]
 * ARGV: [actualCostMicrodollars]
 */
const RECONCILE_LUA = `
local actualCost = tonumber(ARGV[1])

local rsvKey = KEYS[1]
local rsvData = redis.call('GET', rsvKey)
if not rsvData then
  return cjson.encode({status = 'not_found'})
end

local rsv = cjson.decode(rsvData)
local estimate = rsv.estimate

local results = {}
for i = 2, #KEYS do
  if actualCost > 0 then
    redis.call('HINCRBY', KEYS[i], 'spend', actualCost)
  end

  local currentReserved = tonumber(redis.call('HGET', KEYS[i], 'reserved') or '0')
  local decrementBy = math.min(estimate, math.max(currentReserved, 0))
  if decrementBy > 0 then
    redis.call('HINCRBY', KEYS[i], 'reserved', -decrementBy)
  end

  local newSpend = redis.call('HGET', KEYS[i], 'spend')
  results[KEYS[i]] = newSpend
end

redis.call('DEL', rsvKey)

return cjson.encode({status = 'reconciled', spends = results})
`;

/**
 * Script C: populateCache (Fix 9 – atomic, skip-if-exists)
 *
 * KEYS: [entityBudgetKey]
 * ARGV: [maxBudget, spend, policy, ttlSeconds]
 */
const POPULATE_CACHE_LUA = `
if redis.call('EXISTS', KEYS[1]) == 1 then
  return 0
end
redis.call('HSET', KEYS[1], 'maxBudget', ARGV[1], 'spend', ARGV[2], 'reserved', '0', 'policy', ARGV[3])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]))
return 1
`;

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface BudgetDenied {
  status: "denied";
  entityKey: string;
  remaining: number;
  maxBudget: number;
  spend: number;
}

export interface BudgetApproved {
  status: "approved";
  reservationId: string;
}

export type BudgetCheckResult = BudgetDenied | BudgetApproved;

export interface ReconcileResult {
  status: "reconciled" | "not_found";
  spends?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// TypeScript wrappers
// ---------------------------------------------------------------------------

export async function checkAndReserve(
  redis: Redis,
  entityKeys: string[],
  estimateMicrodollars: number,
): Promise<BudgetCheckResult> {
  const reservationId = crypto.randomUUID();
  const rsvKey = `{budget}:rsv:${reservationId}`;

  const result = await redis.eval<BudgetCheckResult>(
    CHECK_AND_RESERVE_LUA,
    entityKeys,
    [
      String(estimateMicrodollars),
      reservationId,
      String(RESERVATION_TTL_SECONDS),
      rsvKey,
    ],
  );

  return result;
}

export async function reconcile(
  redis: Redis,
  reservationId: string,
  entityKeys: string[],
  actualCostMicrodollars: number,
): Promise<ReconcileResult> {
  const rsvKey = `{budget}:rsv:${reservationId}`;

  const result = await redis.eval<ReconcileResult>(
    RECONCILE_LUA,
    [rsvKey, ...entityKeys],
    [String(actualCostMicrodollars)],
  );

  return result;
}

export async function populateCache(
  redis: Redis,
  entityKey: string,
  maxBudget: number,
  spend: number,
  policy: string,
  ttlSeconds: number,
): Promise<number> {
  const result = await redis.eval<number>(
    POPULATE_CACHE_LUA,
    [entityKey],
    [String(maxBudget), String(spend), policy, String(ttlSeconds)],
  );

  return result;
}
