import { describe, it, expect } from "vitest";
import pricingData from "./pricing-data.json";
import type { ModelPricing } from "./types.js";

const catalog = pricingData as Record<string, ModelPricing>;
const entries = Object.entries(catalog);

describe("pricing catalog integrity", () => {
  it("has at least 10 models", () => {
    expect(entries.length).toBeGreaterThanOrEqual(10);
  });

  it("every key follows provider/model format", () => {
    for (const [key] of entries) {
      expect(key).toMatch(/^[a-z]+\/[a-z0-9._-]+$/);
    }
  });

  it("every key has a valid provider prefix", () => {
    const validProviders = new Set(["openai", "anthropic", "google"]);
    for (const [key] of entries) {
      const provider = key.split("/")[0];
      expect(validProviders.has(provider), `unknown provider: ${provider} in ${key}`).toBe(true);
    }
  });

  it("no duplicate keys (JSON parse would merge, but verify explicit structure)", () => {
    const keys = entries.map(([k]) => k);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("per-model field validation", () => {
  for (const [key, pricing] of entries) {
    describe(key, () => {
      it("has positive inputPerMTok", () => {
        expect(pricing.inputPerMTok).toBeGreaterThan(0);
        expect(Number.isFinite(pricing.inputPerMTok)).toBe(true);
      });

      it("has non-negative cachedInputPerMTok", () => {
        expect(pricing.cachedInputPerMTok).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(pricing.cachedInputPerMTok)).toBe(true);
      });

      it("has positive outputPerMTok", () => {
        expect(pricing.outputPerMTok).toBeGreaterThan(0);
        expect(Number.isFinite(pricing.outputPerMTok)).toBe(true);
      });

      it("cached input rate is <= standard input rate", () => {
        expect(pricing.cachedInputPerMTok).toBeLessThanOrEqual(pricing.inputPerMTok);
      });

      it("output rate is >= input rate (standard LLM pricing pattern)", () => {
        expect(pricing.outputPerMTok).toBeGreaterThanOrEqual(pricing.inputPerMTok);
      });

      if (key.startsWith("anthropic/")) {
        it("has cacheWrite5mPerMTok field", () => {
          expect(pricing.cacheWrite5mPerMTok).toBeDefined();
          expect(pricing.cacheWrite5mPerMTok).toBeGreaterThan(0);
        });

        it("has cacheWrite1hPerMTok field", () => {
          expect(pricing.cacheWrite1hPerMTok).toBeDefined();
          expect(pricing.cacheWrite1hPerMTok).toBeGreaterThan(0);
        });

        it("5m cache write rate is 1.25x base input (Anthropic pricing rule)", () => {
          expect(pricing.cacheWrite5mPerMTok).toBeCloseTo(pricing.inputPerMTok * 1.25, 10);
        });

        it("1h cache write rate is 2.0x base input (Anthropic pricing rule)", () => {
          expect(pricing.cacheWrite1hPerMTok).toBeCloseTo(pricing.inputPerMTok * 2.0, 10);
        });

        it("cache write rates follow 5m < 1h ordering", () => {
          expect(pricing.cacheWrite5mPerMTok!).toBeLessThan(pricing.cacheWrite1hPerMTok!);
        });
      }

      if (key.startsWith("openai/") || key.startsWith("google/")) {
        it("does NOT have Anthropic-specific cache write fields", () => {
          expect(pricing.cacheWrite5mPerMTok).toBeUndefined();
          expect(pricing.cacheWrite1hPerMTok).toBeUndefined();
        });
      }

      it("no unexpected fields exist", () => {
        const allowedKeys = new Set([
          "inputPerMTok",
          "cachedInputPerMTok",
          "outputPerMTok",
          "cacheWrite5mPerMTok",
          "cacheWrite1hPerMTok",
        ]);
        for (const field of Object.keys(pricing)) {
          expect(allowedKeys.has(field), `unexpected field "${field}" in ${key}`).toBe(true);
        }
      });

      it("no NaN or Infinity values", () => {
        for (const [field, value] of Object.entries(pricing)) {
          if (typeof value === "number") {
            expect(Number.isNaN(value), `NaN in ${key}.${field}`).toBe(false);
            expect(Number.isFinite(value), `Infinity in ${key}.${field}`).toBe(true);
          }
        }
      });
    });
  }
});

describe("cross-model sanity checks", () => {
  it("opus is the most expensive Anthropic model per output token", () => {
    const opus = catalog["anthropic/claude-opus-4"];
    const sonnet = catalog["anthropic/claude-sonnet-4-6"];
    const haiku = catalog["anthropic/claude-haiku-3.5"];

    expect(opus.outputPerMTok).toBeGreaterThan(sonnet.outputPerMTok);
    expect(sonnet.outputPerMTok).toBeGreaterThan(haiku.outputPerMTok);
  });

  it("gpt-4o is more expensive than gpt-4o-mini", () => {
    const full = catalog["openai/gpt-4o"];
    const mini = catalog["openai/gpt-4o-mini"];

    expect(full.inputPerMTok).toBeGreaterThan(mini.inputPerMTok);
    expect(full.outputPerMTok).toBeGreaterThan(mini.outputPerMTok);
  });

  it("gpt-4.1 is more expensive than gpt-4.1-mini", () => {
    const full = catalog["openai/gpt-4.1"];
    const mini = catalog["openai/gpt-4.1-mini"];

    expect(full.inputPerMTok).toBeGreaterThan(mini.inputPerMTok);
    expect(full.outputPerMTok).toBeGreaterThan(mini.outputPerMTok);
  });

  it("gemini-2.5-pro is more expensive than gemini-2.5-flash", () => {
    const pro = catalog["google/gemini-2.5-pro"];
    const flash = catalog["google/gemini-2.5-flash"];

    expect(pro.inputPerMTok).toBeGreaterThan(flash.inputPerMTok);
    expect(pro.outputPerMTok).toBeGreaterThan(flash.outputPerMTok);
  });

  it("every provider has at least 2 models", () => {
    const byProvider = new Map<string, number>();
    for (const [key] of entries) {
      const provider = key.split("/")[0];
      byProvider.set(provider, (byProvider.get(provider) ?? 0) + 1);
    }
    for (const [provider, count] of byProvider) {
      expect(count, `${provider} should have ≥2 models`).toBeGreaterThanOrEqual(2);
    }
  });
});
