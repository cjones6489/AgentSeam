import { afterEach, describe, expect, it } from "vitest";

import { ApiKeyError, assertApiKey } from "@/lib/auth/api-key";

function makeRequest(headers?: Record<string, string>): Request {
  return new Request("http://localhost/api/actions", {
    method: "POST",
    headers,
  });
}

describe("assertApiKey", () => {
  const originalKey = process.env.AGENTSEAM_API_KEY;
  const originalNodeEnv = process.env.NODE_ENV;

  function setNodeEnv(value: string | undefined) {
    Object.assign(process.env, { NODE_ENV: value });
  }

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.AGENTSEAM_API_KEY = originalKey;
    } else {
      delete process.env.AGENTSEAM_API_KEY;
    }
    setNodeEnv(originalNodeEnv);
  });

  it("passes when the correct key is provided in development", () => {
    setNodeEnv("development");
    process.env.AGENTSEAM_API_KEY = "test-secret-key";
    const request = makeRequest({ "x-agentseam-key": "test-secret-key" });

    expect(() => assertApiKey(request)).not.toThrow();
  });

  it("rejects env fallback key in production", () => {
    setNodeEnv("production");
    process.env.AGENTSEAM_API_KEY = "test-secret-key";
    const request = makeRequest({ "x-agentseam-key": "test-secret-key" });

    expect(() => assertApiKey(request)).toThrow(ApiKeyError);
  });

  it("throws ApiKeyError when no header is provided", () => {
    setNodeEnv("development");
    process.env.AGENTSEAM_API_KEY = "test-secret-key";
    const request = makeRequest();

    expect(() => assertApiKey(request)).toThrow(ApiKeyError);
  });

  it("throws ApiKeyError when the wrong key is provided", () => {
    setNodeEnv("development");
    process.env.AGENTSEAM_API_KEY = "test-secret-key";
    const request = makeRequest({ "x-agentseam-key": "wrong-key-value" });

    expect(() => assertApiKey(request)).toThrow(ApiKeyError);
  });

  it("throws ApiKeyError when key has different length", () => {
    setNodeEnv("development");
    process.env.AGENTSEAM_API_KEY = "test-secret-key";
    const request = makeRequest({ "x-agentseam-key": "short" });

    expect(() => assertApiKey(request)).toThrow(ApiKeyError);
  });

  it("throws ApiKeyError when AGENTSEAM_API_KEY is not configured and key does not match", () => {
    delete process.env.AGENTSEAM_API_KEY;
    const request = makeRequest({ "x-agentseam-key": "any-key" });

    expect(() => assertApiKey(request)).toThrow(ApiKeyError);
  });
});
