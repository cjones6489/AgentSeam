import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadConfig, ConfigError } from "./config.js";

describe("loadConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns config when all required vars are set", () => {
    process.env.AGENTSEAM_URL = "http://localhost:3000";
    process.env.AGENTSEAM_API_KEY = "ask_test123";

    const config = loadConfig();
    expect(config.agentseamUrl).toBe("http://localhost:3000");
    expect(config.agentseamApiKey).toBe("ask_test123");
    expect(config.agentId).toBe("mcp-agent");
  });

  it("uses custom AGENTSEAM_AGENT_ID when set", () => {
    process.env.AGENTSEAM_URL = "http://localhost:3000";
    process.env.AGENTSEAM_API_KEY = "ask_test123";
    process.env.AGENTSEAM_AGENT_ID = "my-custom-agent";

    const config = loadConfig();
    expect(config.agentId).toBe("my-custom-agent");
  });

  it("throws ConfigError when AGENTSEAM_URL is missing", () => {
    process.env.AGENTSEAM_API_KEY = "ask_test123";
    delete process.env.AGENTSEAM_URL;

    expect(() => loadConfig()).toThrow(ConfigError);
    expect(() => loadConfig()).toThrow("AGENTSEAM_URL");
  });

  it("throws ConfigError when AGENTSEAM_API_KEY is missing", () => {
    process.env.AGENTSEAM_URL = "http://localhost:3000";
    delete process.env.AGENTSEAM_API_KEY;

    expect(() => loadConfig()).toThrow(ConfigError);
    expect(() => loadConfig()).toThrow("AGENTSEAM_API_KEY");
  });

  it("throws ConfigError listing all missing vars", () => {
    delete process.env.AGENTSEAM_URL;
    delete process.env.AGENTSEAM_API_KEY;

    try {
      loadConfig();
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as ConfigError).message).toContain("AGENTSEAM_URL");
      expect((err as ConfigError).message).toContain("AGENTSEAM_API_KEY");
    }
  });
});
