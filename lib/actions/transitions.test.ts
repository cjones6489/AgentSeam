import { describe, expect, it } from "vitest";

import { InvalidActionTransitionError } from "@/lib/actions/errors";
import { assertActionTransition } from "@/lib/actions/transitions";
import { canTransitionStatus } from "@/lib/utils/status";

describe("action transitions", () => {
  it("allows valid pending decisions", () => {
    expect(canTransitionStatus("pending", "approved")).toBe(true);
    expect(canTransitionStatus("pending", "rejected")).toBe(true);
    expect(canTransitionStatus("pending", "expired")).toBe(true);
  });

  it("allows execution progression after approval", () => {
    expect(canTransitionStatus("approved", "executing")).toBe(true);
    expect(canTransitionStatus("executing", "executed")).toBe(true);
    expect(canTransitionStatus("executing", "failed")).toBe(true);
  });

  it("rejects invalid state jumps", () => {
    expect(() => assertActionTransition("pending", "executed")).toThrow(
      InvalidActionTransitionError,
    );
    expect(() => assertActionTransition("rejected", "approved")).toThrow(
      InvalidActionTransitionError,
    );
    expect(() => assertActionTransition("executed", "failed")).toThrow(
      InvalidActionTransitionError,
    );
  });
});
