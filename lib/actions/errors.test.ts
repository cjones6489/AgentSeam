import { describe, it, expect } from "vitest";

import {
  ActionNotFoundError,
  InvalidActionTransitionError,
  StaleActionError,
  ActionExpiredError,
} from "@/lib/actions/errors";

describe("ActionNotFoundError", () => {
  it("sets name and message", () => {
    const err = new ActionNotFoundError("abc-123");
    expect(err.name).toBe("ActionNotFoundError");
    expect(err.message).toBe("Action abc-123 was not found.");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("InvalidActionTransitionError", () => {
  it("sets name and message with statuses", () => {
    const err = new InvalidActionTransitionError("pending", "executed");
    expect(err.name).toBe("InvalidActionTransitionError");
    expect(err.message).toBe(
      "Cannot transition action from pending to executed.",
    );
    expect(err).toBeInstanceOf(Error);
  });
});

describe("StaleActionError", () => {
  it("sets name and message", () => {
    const err = new StaleActionError("abc-123");
    expect(err.name).toBe("StaleActionError");
    expect(err.message).toContain("abc-123");
    expect(err.message).toContain("modified concurrently");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("ActionExpiredError", () => {
  it("sets name and message", () => {
    const err = new ActionExpiredError("abc-123");
    expect(err.name).toBe("ActionExpiredError");
    expect(err.message).toContain("abc-123");
    expect(err.message).toContain("expired");
    expect(err).toBeInstanceOf(Error);
  });
});
