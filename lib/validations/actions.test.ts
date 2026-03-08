import { describe, expect, it } from "vitest";

import {
  createActionInputSchema,
  markResultInputSchema,
} from "@/lib/validations/actions";

describe("action validation schemas", () => {
  it("accepts a valid action creation payload", () => {
    const parsed = createActionInputSchema.parse({
      agentId: "sales-agent-1",
      actionType: "http_post",
      payload: {
        url: "https://example.com/hooks/outbound",
        body: {
          subject: "Follow up",
        },
      },
      metadata: {
        environment: "dev",
        sourceFramework: "custom-ts",
      },
    });

    expect(parsed.actionType).toBe("http_post");
    expect(parsed.metadata?.environment).toBe("dev");
  });

  it("rejects an unsupported action type", () => {
    expect(() =>
      createActionInputSchema.parse({
        agentId: "sales-agent-1",
        actionType: "http_patch",
        payload: {
          url: "https://example.com",
        },
      }),
    ).toThrow();
  });

  it("requires an error message for failed execution results", () => {
    expect(() =>
      markResultInputSchema.parse({
        status: "failed",
      }),
    ).toThrow();
  });

  it("rejects result payloads while execution is still in progress", () => {
    expect(() =>
      markResultInputSchema.parse({
        status: "executing",
        result: {
          ok: true,
        },
      }),
    ).toThrow();
  });
});
