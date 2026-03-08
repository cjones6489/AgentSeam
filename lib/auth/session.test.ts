import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AuthenticationRequiredError,
  SupabaseEnvError,
} from "@/lib/auth/errors";
import { resolveApprovalActor } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/auth/supabase";

vi.mock("@/lib/auth/supabase", () => ({
  createServerSupabaseClient: vi.fn(),
}));

const mockedCreateServerSupabaseClient = vi.mocked(createServerSupabaseClient);

describe("resolveApprovalActor", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDevActor = process.env.AGENTSEAM_DEV_ACTOR;

  function setNodeEnv(value: string | undefined) {
    Object.assign(process.env, { NODE_ENV: value });
  }

  afterEach(() => {
    setNodeEnv(originalNodeEnv);
    process.env.AGENTSEAM_DEV_ACTOR = originalDevActor;
    vi.resetAllMocks();
  });

  it("uses the authenticated Supabase user id when available", async () => {
    mockedCreateServerSupabaseClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: { sub: "user-123" } },
          error: null,
        }),
      },
    } as never);

    await expect(resolveApprovalActor()).resolves.toBe("user-123");
  });

  it("uses AGENTSEAM_DEV_ACTOR env var in development when auth is unavailable", async () => {
    setNodeEnv("development");
    process.env.AGENTSEAM_DEV_ACTOR = "env-dev-actor";
    mockedCreateServerSupabaseClient.mockRejectedValue(
      new SupabaseEnvError("NEXT_PUBLIC_SUPABASE_URL"),
    );

    await expect(resolveApprovalActor()).resolves.toBe("env-dev-actor");
  });

  it("uses AGENTSEAM_DEV_ACTOR in dev when auth returns no user", async () => {
    setNodeEnv("development");
    process.env.AGENTSEAM_DEV_ACTOR = "env-dev-actor";
    mockedCreateServerSupabaseClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: {} },
          error: null,
        }),
      },
    } as never);

    await expect(resolveApprovalActor()).resolves.toBe("env-dev-actor");
  });

  it("throws in development when auth fails and AGENTSEAM_DEV_ACTOR is not set", async () => {
    setNodeEnv("development");
    delete process.env.AGENTSEAM_DEV_ACTOR;
    mockedCreateServerSupabaseClient.mockRejectedValue(
      new SupabaseEnvError("NEXT_PUBLIC_SUPABASE_URL"),
    );

    await expect(resolveApprovalActor()).rejects.toBeInstanceOf(SupabaseEnvError);
  });

  it("requires auth in production even when AGENTSEAM_DEV_ACTOR is set", async () => {
    setNodeEnv("production");
    process.env.AGENTSEAM_DEV_ACTOR = "env-dev-actor";
    mockedCreateServerSupabaseClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: {} },
          error: null,
        }),
      },
    } as never);

    await expect(resolveApprovalActor()).rejects.toBeInstanceOf(
      AuthenticationRequiredError,
    );
  });

  it("requires auth in production when no user is available", async () => {
    setNodeEnv("production");
    delete process.env.AGENTSEAM_DEV_ACTOR;
    mockedCreateServerSupabaseClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: {} },
          error: null,
        }),
      },
    } as never);

    await expect(resolveApprovalActor()).rejects.toBeInstanceOf(
      AuthenticationRequiredError,
    );
  });
});
