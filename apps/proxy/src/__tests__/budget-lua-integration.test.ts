/**
 * Integration tests for the three budget Lua scripts against a real Upstash
 * Redis instance.  These verify atomicity, correctness, and edge cases that
 * unit tests with mocked Redis cannot cover.
 *
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN — either in
 * process.env or in apps/proxy/.dev.vars.  Skips gracefully when absent.
 *
 * Run with:  pnpm proxy:test:integration
 */
import { Redis } from "@upstash/redis";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";

import {
  checkAndReserve,
  reconcile,
  populateCache,
  type BudgetApproved,
  type BudgetDenied,
} from "../lib/budget.js";

// ---------------------------------------------------------------------------
// Credential loading
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDevVars(): void {
  try {
    const content = readFileSync(
      resolve(__dirname, "../../.dev.vars"),
      "utf-8",
    );
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx);
      const val = trimmed.slice(idx + 1).replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .dev.vars not found — rely on process.env
  }
}

loadDevVars();

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const hasCredentials = Boolean(
  url && token && !url.includes("your-redis"),
);

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe.runIf(hasCredentials)("Budget Lua scripts (integration)", () => {
  let redis: Redis;
  const runId = crypto.randomUUID().slice(0, 8);
  let keysToCleanup: string[] = [];

  /** Create a namespaced entity key and register it for cleanup. */
  function eKey(name: string): string {
    const key = `{test}:${runId}:${name}`;
    keysToCleanup.push(key);
    return key;
  }

  /** Register an arbitrary key for cleanup. */
  function track(key: string): void {
    keysToCleanup.push(key);
  }

  /**
   * Return the Redis client cast to `any` so it satisfies the Cloudflare
   * Redis type expected by the budget wrappers (structurally compatible).
   */
  function r(): any {
    return redis;
  }

  beforeAll(() => {
    redis = new Redis({ url: url!, token: token! });
  });

  afterEach(async () => {
    if (!redis || keysToCleanup.length === 0) return;
    await redis.del(...keysToCleanup);
    keysToCleanup = [];
  });

  afterAll(async () => {
    if (!redis) return;
    // afterEach handles per-test cleanup; nothing else needed.
  });

  // -----------------------------------------------------------------------
  // populateCache
  // -----------------------------------------------------------------------
  describe("populateCache", () => {
    it("creates hash with correct fields", async () => {
      const key = eKey("pop-fields");
      const result = await populateCache(
        r(),
        key,
        50_000_000,
        3_000_000,
        "strict_block",
        120,
      );

      expect(result).toBe(1);

      const hash = await redis.hgetall(key);
      expect(hash).toBeTruthy();
      expect(Number(hash!.maxBudget)).toBe(50_000_000);
      expect(Number(hash!.spend)).toBe(3_000_000);
      expect(Number(hash!.reserved)).toBe(0);
      expect(String(hash!.policy)).toBe("strict_block");
    });

    it("returns 0 when key already exists (skip-if-exists)", async () => {
      const key = eKey("pop-idempotent");

      const first = await populateCache(
        r(),
        key,
        50_000_000,
        0,
        "strict_block",
        120,
      );
      expect(first).toBe(1);

      const second = await populateCache(
        r(),
        key,
        99_000_000,
        50_000_000,
        "warn_only",
        300,
      );
      expect(second).toBe(0);

      const hash = await redis.hgetall(key);
      expect(Number(hash!.maxBudget)).toBe(50_000_000);
      expect(Number(hash!.spend)).toBe(0);
      expect(String(hash!.policy)).toBe("strict_block");
    });

    it("applies TTL", async () => {
      const key = eKey("pop-ttl");
      await populateCache(r(), key, 10_000_000, 0, "strict_block", 60);

      const ttl = await redis.ttl(key);
      expect(ttl).toBeGreaterThan(55);
      expect(ttl).toBeLessThanOrEqual(60);
    });
  });

  // -----------------------------------------------------------------------
  // checkAndReserve
  // -----------------------------------------------------------------------
  describe("checkAndReserve", () => {
    it("approves under budget and increments reserved", async () => {
      const key = eKey("rsv-approve");
      await populateCache(r(), key, 50_000_000, 0, "strict_block", 120);

      const result = await checkAndReserve(r(), [key], 10_000_000);

      expect(result.status).toBe("approved");
      const approved = result as BudgetApproved;
      expect(approved.reservationId).toBeTruthy();
      track(`{budget}:rsv:${approved.reservationId}`);

      const reserved = await redis.hget(key, "reserved");
      expect(Number(reserved)).toBe(10_000_000);
    });

    it("denies when over budget and does NOT mutate state", async () => {
      const key = eKey("rsv-deny");
      await populateCache(r(), key, 10_000_000, 8_000_000, "strict_block", 120);

      const result = await checkAndReserve(r(), [key], 5_000_000);

      expect(result.status).toBe("denied");
      const denied = result as BudgetDenied;
      expect(denied.entityKey).toBe(key);
      expect(denied.remaining).toBe(2_000_000);
      expect(denied.maxBudget).toBe(10_000_000);
      expect(denied.spend).toBe(8_000_000);

      const reserved = await redis.hget(key, "reserved");
      expect(Number(reserved)).toBe(0);
    });

    it("approves multi-entity and reserves on all", async () => {
      const k1 = eKey("rsv-m1");
      const k2 = eKey("rsv-m2");
      await populateCache(r(), k1, 50_000_000, 0, "strict_block", 120);
      await populateCache(r(), k2, 30_000_000, 0, "strict_block", 120);

      const result = await checkAndReserve(r(), [k1, k2], 5_000_000);

      expect(result.status).toBe("approved");
      track(`{budget}:rsv:${(result as BudgetApproved).reservationId}`);

      expect(Number(await redis.hget(k1, "reserved"))).toBe(5_000_000);
      expect(Number(await redis.hget(k2, "reserved"))).toBe(5_000_000);
    });

    it("denies multi-entity when second fails — first NOT mutated (atomicity)", async () => {
      const k1 = eKey("rsv-atom-ok");
      const k2 = eKey("rsv-atom-fail");
      await populateCache(r(), k1, 50_000_000, 0, "strict_block", 120);
      await populateCache(r(), k2, 5_000_000, 4_000_000, "strict_block", 120);

      const result = await checkAndReserve(r(), [k1, k2], 3_000_000);

      expect(result.status).toBe("denied");
      expect((result as BudgetDenied).entityKey).toBe(k2);

      expect(Number(await redis.hget(k1, "reserved"))).toBe(0);
    });

    it("reservation key stores correct payload", async () => {
      const key = eKey("rsv-payload");
      await populateCache(r(), key, 50_000_000, 0, "strict_block", 120);

      const result = await checkAndReserve(r(), [key], 7_500_000);
      expect(result.status).toBe("approved");

      const rsvId = (result as BudgetApproved).reservationId;
      const rsvKey = `{budget}:rsv:${rsvId}`;
      track(rsvKey);

      const raw = await redis.get(rsvKey);
      expect(raw).toBeTruthy();

      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      expect(data.keys).toEqual([key]);
      expect(data.estimate).toBe(7_500_000);
    });
  });

  // -----------------------------------------------------------------------
  // reconcile
  // -----------------------------------------------------------------------
  describe("reconcile", () => {
    it("adjusts spend/reserved and deletes reservation key", async () => {
      const key = eKey("rec-normal");
      await populateCache(r(), key, 50_000_000, 0, "strict_block", 120);

      const rsv = await checkAndReserve(r(), [key], 10_000_000);
      expect(rsv.status).toBe("approved");
      const rsvId = (rsv as BudgetApproved).reservationId;
      track(`{budget}:rsv:${rsvId}`);

      const result = await reconcile(r(), rsvId, [key], 7_000_000);

      expect(result.status).toBe("reconciled");

      const hash = await redis.hgetall(key);
      expect(Number(hash!.spend)).toBe(7_000_000);
      expect(Number(hash!.reserved)).toBe(0);

      expect(await redis.exists(`{budget}:rsv:${rsvId}`)).toBe(0);
    });

    it("zero actual cost only clears reserved, spend unchanged", async () => {
      const key = eKey("rec-zero");
      await populateCache(r(), key, 50_000_000, 5_000_000, "strict_block", 120);

      const rsv = await checkAndReserve(r(), [key], 8_000_000);
      expect(rsv.status).toBe("approved");
      const rsvId = (rsv as BudgetApproved).reservationId;
      track(`{budget}:rsv:${rsvId}`);

      const result = await reconcile(r(), rsvId, [key], 0);
      expect(result.status).toBe("reconciled");

      const hash = await redis.hgetall(key);
      expect(Number(hash!.spend)).toBe(5_000_000);
      expect(Number(hash!.reserved)).toBe(0);
    });

    it("returns not_found when reservation is missing", async () => {
      const key = eKey("rec-notfound");
      await populateCache(r(), key, 50_000_000, 0, "strict_block", 120);

      const result = await reconcile(r(), crypto.randomUUID(), [key], 1_000_000);
      expect(result.status).toBe("not_found");

      const hash = await redis.hgetall(key);
      expect(Number(hash!.spend)).toBe(0);
    });

    it("clamps reserved to zero when manually reduced below estimate", async () => {
      const key = eKey("rec-clamp");
      await populateCache(r(), key, 50_000_000, 0, "strict_block", 120);

      const rsv = await checkAndReserve(r(), [key], 10_000_000);
      expect(rsv.status).toBe("approved");
      const rsvId = (rsv as BudgetApproved).reservationId;
      track(`{budget}:rsv:${rsvId}`);

      await redis.hset(key, { reserved: "3000000" });

      const result = await reconcile(r(), rsvId, [key], 5_000_000);
      expect(result.status).toBe("reconciled");

      const hash = await redis.hgetall(key);
      expect(Number(hash!.reserved)).toBe(0);
      expect(Number(hash!.spend)).toBe(5_000_000);
    });
  });

  // -----------------------------------------------------------------------
  // Full lifecycle
  // -----------------------------------------------------------------------
  describe("full lifecycle", () => {
    it("populate → reserve → reconcile with correct final state", async () => {
      const key = eKey("life-happy");

      const pop = await populateCache(
        r(),
        key,
        100_000_000,
        20_000_000,
        "strict_block",
        120,
      );
      expect(pop).toBe(1);

      const rsv = await checkAndReserve(r(), [key], 15_000_000);
      expect(rsv.status).toBe("approved");
      const rsvId = (rsv as BudgetApproved).reservationId;
      track(`{budget}:rsv:${rsvId}`);

      const mid = await redis.hgetall(key);
      expect(Number(mid!.reserved)).toBe(15_000_000);
      expect(Number(mid!.spend)).toBe(20_000_000);

      const rec = await reconcile(r(), rsvId, [key], 12_000_000);
      expect(rec.status).toBe("reconciled");

      const fin = await redis.hgetall(key);
      expect(Number(fin!.spend)).toBe(32_000_000);
      expect(Number(fin!.reserved)).toBe(0);
      expect(Number(fin!.maxBudget)).toBe(100_000_000);
    });

    it("concurrent reservations resolve correctly", async () => {
      const key = eKey("life-concurrent");
      await populateCache(r(), key, 100_000_000, 0, "strict_block", 120);

      const [r1, r2] = await Promise.all([
        checkAndReserve(r(), [key], 20_000_000),
        checkAndReserve(r(), [key], 30_000_000),
      ]);

      expect(r1.status).toBe("approved");
      expect(r2.status).toBe("approved");
      const id1 = (r1 as BudgetApproved).reservationId;
      const id2 = (r2 as BudgetApproved).reservationId;
      track(`{budget}:rsv:${id1}`);
      track(`{budget}:rsv:${id2}`);

      expect(Number(await redis.hget(key, "reserved"))).toBe(50_000_000);

      await reconcile(r(), id1, [key], 18_000_000);
      await reconcile(r(), id2, [key], 25_000_000);

      const fin = await redis.hgetall(key);
      expect(Number(fin!.spend)).toBe(43_000_000);
      expect(Number(fin!.reserved)).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe("edge cases", () => {
    it("large microdollar values handled without precision loss", async () => {
      const key = eKey("edge-large");
      const budget = 1_000_000_000_000; // $1M in microdollars
      const spend = 500_000_000_000;

      await populateCache(r(), key, budget, spend, "strict_block", 120);

      const estimate = 200_000_000_000;
      const rsv = await checkAndReserve(r(), [key], estimate);
      expect(rsv.status).toBe("approved");
      const rsvId = (rsv as BudgetApproved).reservationId;
      track(`{budget}:rsv:${rsvId}`);

      expect(Number(await redis.hget(key, "reserved"))).toBe(estimate);

      const actual = 180_000_000_000;
      await reconcile(r(), rsvId, [key], actual);

      const fin = await redis.hgetall(key);
      expect(Number(fin!.spend)).toBe(spend + actual);
      expect(Number(fin!.reserved)).toBe(0);
    });

    it("denied response fields match exact Redis state", async () => {
      const key = eKey("edge-deny-acc");
      await populateCache(r(), key, 50_000_000, 30_000_000, "strict_block", 120);

      const first = await checkAndReserve(r(), [key], 5_000_000);
      expect(first.status).toBe("approved");
      track(`{budget}:rsv:${(first as BudgetApproved).reservationId}`);

      // remaining = 50M - 30M(spend) - 5M(reserved) = 15M
      const result = await checkAndReserve(r(), [key], 20_000_000);

      expect(result.status).toBe("denied");
      const denied = result as BudgetDenied;
      expect(denied.entityKey).toBe(key);
      expect(denied.remaining).toBe(15_000_000);
      expect(denied.maxBudget).toBe(50_000_000);
      expect(denied.spend).toBe(30_000_000);
    });
  });

  // -----------------------------------------------------------------------
  // Stress tests: race conditions and production failure modes
  // -----------------------------------------------------------------------
  describe("race conditions", () => {
    it("concurrent reserves that collectively exceed budget — one denied", async () => {
      const key = eKey("race-exceed");
      await populateCache(r(), key, 50_000_000, 0, "strict_block", 120);

      // Two requests each want 30M against a 50M budget.
      // Redis is single-threaded, so Lua scripts serialize.
      // First gets approved (remaining 50M >= 30M), second denied (20M < 30M).
      const [a, b] = await Promise.all([
        checkAndReserve(r(), [key], 30_000_000),
        checkAndReserve(r(), [key], 30_000_000),
      ]);

      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual(["approved", "denied"]);

      const approved = (a.status === "approved" ? a : b) as BudgetApproved;
      const denied = (a.status === "denied" ? a : b) as BudgetDenied;
      track(`{budget}:rsv:${approved.reservationId}`);

      expect(denied.remaining).toBe(20_000_000);
      expect(Number(await redis.hget(key, "reserved"))).toBe(30_000_000);
    });

    it("double reconcile — second returns not_found, spend NOT double-counted", async () => {
      const key = eKey("race-double-rec");
      await populateCache(r(), key, 50_000_000, 0, "strict_block", 120);

      const rsv = await checkAndReserve(r(), [key], 10_000_000);
      expect(rsv.status).toBe("approved");
      const rsvId = (rsv as BudgetApproved).reservationId;
      track(`{budget}:rsv:${rsvId}`);

      const first = await reconcile(r(), rsvId, [key], 8_000_000);
      expect(first.status).toBe("reconciled");

      const second = await reconcile(r(), rsvId, [key], 8_000_000);
      expect(second.status).toBe("not_found");

      // Spend must be exactly 8M — not 16M
      const hash = await redis.hgetall(key);
      expect(Number(hash!.spend)).toBe(8_000_000);
      expect(Number(hash!.reserved)).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Boundary precision
  // -----------------------------------------------------------------------
  describe("boundary precision", () => {
    it("exact boundary: spend + reserved + estimate == maxBudget → approved", async () => {
      const key = eKey("bound-exact");
      // 40M spent, 0 reserved. 10M estimate. 40 + 0 + 10 = 50 == 50 (not >)
      await populateCache(r(), key, 50_000_000, 40_000_000, "strict_block", 120);

      const result = await checkAndReserve(r(), [key], 10_000_000);
      expect(result.status).toBe("approved");
      track(`{budget}:rsv:${(result as BudgetApproved).reservationId}`);

      expect(Number(await redis.hget(key, "reserved"))).toBe(10_000_000);
    });

    it("exact boundary + 1: spend + reserved + estimate > maxBudget → denied", async () => {
      const key = eKey("bound-over");
      await populateCache(r(), key, 50_000_000, 40_000_000, "strict_block", 120);

      const result = await checkAndReserve(r(), [key], 10_000_001);
      expect(result.status).toBe("denied");

      const denied = result as BudgetDenied;
      expect(denied.remaining).toBe(10_000_000);
      expect(Number(await redis.hget(key, "reserved"))).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Reservation stacking
  // -----------------------------------------------------------------------
  describe("reservation stacking", () => {
    it("accumulated reservations block new requests before spend catches up", async () => {
      const key = eKey("stack-exhaust");
      // 100M budget, 0 spent
      await populateCache(r(), key, 100_000_000, 0, "strict_block", 120);

      const rsvIds: string[] = [];

      // Stack 4 reservations of 25M each = 100M reserved (fills budget)
      for (let i = 0; i < 4; i++) {
        const rsv = await checkAndReserve(r(), [key], 25_000_000);
        expect(rsv.status).toBe("approved");
        const id = (rsv as BudgetApproved).reservationId;
        rsvIds.push(id);
        track(`{budget}:rsv:${id}`);
      }

      expect(Number(await redis.hget(key, "reserved"))).toBe(100_000_000);
      expect(Number(await redis.hget(key, "spend"))).toBe(0);

      // Fifth reservation should be denied even though spend is still 0
      const denied = await checkAndReserve(r(), [key], 1);
      expect(denied.status).toBe("denied");

      // Reconcile all — actual costs are lower than estimates
      for (const id of rsvIds) {
        await reconcile(r(), id, [key], 20_000_000);
      }

      const fin = await redis.hgetall(key);
      expect(Number(fin!.spend)).toBe(80_000_000); // 4 * 20M
      expect(Number(fin!.reserved)).toBe(0);

      // After reconcile, 20M remaining — a new reservation should succeed
      const after = await checkAndReserve(r(), [key], 15_000_000);
      expect(after.status).toBe("approved");
      track(`{budget}:rsv:${(after as BudgetApproved).reservationId}`);
    });
  });

  // -----------------------------------------------------------------------
  // Pipeline-based lookup pattern
  // -----------------------------------------------------------------------
  describe("pipeline lookup pattern", () => {
    it("pipeline hgetall + get reads budget hash and negative marker correctly", async () => {
      const budgetKey = eKey("pipe-budget");
      const noneKey = eKey("pipe-none-marker");
      const emptyKey = eKey("pipe-empty");
      const emptyNoneKey = eKey("pipe-empty-none");

      // Set up: one populated budget, one negative-cache marker, one miss
      await populateCache(r(), budgetKey, 50_000_000, 10_000_000, "strict_block", 120);
      await redis.set(noneKey, "1", { ex: 120 });

      const p = redis.pipeline();
      // Entity 1: has budget
      p.hgetall(budgetKey);
      p.get(noneKey.replace("none-marker", "nonexistent")); // no none marker
      // Entity 2: has negative cache
      p.hgetall(eKey("pipe-no-hash")); // no hash
      p.get(noneKey); // has "1"
      // Entity 3: complete miss
      p.hgetall(emptyKey);
      p.get(emptyNoneKey);

      const results = await p.exec();

      // Entity 1: hash exists with correct fields
      const hash1 = results[0] as Record<string, unknown> | null;
      expect(hash1).toBeTruthy();
      expect(Number(hash1!.maxBudget)).toBe(50_000_000);
      expect(Number(hash1!.spend)).toBe(10_000_000);
      expect(Number(hash1!.reserved)).toBe(0);
      expect(String(hash1!.policy)).toBe("strict_block");

      // Entity 1: no none marker
      expect(results[1]).toBeNull();

      // Entity 2: no hash
      expect(results[2]).toBeNull();

      // Entity 2: negative cache marker present (SDK auto-deserializes "1" → number 1)
      expect(results[3]).toBe(1);

      // Entity 3: complete miss — both null
      expect(results[4]).toBeNull();
      expect(results[5]).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // State corruption resilience
  // -----------------------------------------------------------------------
  describe("state corruption resilience", () => {
    it("reconcile works when spend already exceeds maxBudget", async () => {
      const key = eKey("corrupt-overspend");
      await populateCache(r(), key, 50_000_000, 0, "strict_block", 120);

      // Create a valid reservation
      const rsv = await checkAndReserve(r(), [key], 10_000_000);
      expect(rsv.status).toBe("approved");
      const rsvId = (rsv as BudgetApproved).reservationId;
      track(`{budget}:rsv:${rsvId}`);

      // Corrupt state: set spend way above maxBudget
      await redis.hset(key, { spend: "999000000" });

      // Reconcile should still succeed — it doesn't validate invariants
      const result = await reconcile(r(), rsvId, [key], 5_000_000);
      expect(result.status).toBe("reconciled");

      const hash = await redis.hgetall(key);
      // spend = 999M + 5M = 1.004B
      expect(Number(hash!.spend)).toBe(1_004_000_000);
      expect(Number(hash!.reserved)).toBe(0);
    });

    it("checkAndReserve correctly denies when state is already corrupted", async () => {
      const key = eKey("corrupt-deny");
      await populateCache(r(), key, 50_000_000, 0, "strict_block", 120);

      // Corrupt: spend already beyond budget
      await redis.hset(key, { spend: "60000000" });

      const result = await checkAndReserve(r(), [key], 1);
      expect(result.status).toBe("denied");

      const denied = result as BudgetDenied;
      expect(denied.spend).toBe(60_000_000);
      // remaining = 50M - 60M - 0 = -10M (negative is allowed in response)
      expect(denied.remaining).toBe(-10_000_000);
    });
  });
});
