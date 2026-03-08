import { describe, expect, it } from "vitest";

import { actionKeys } from "@/lib/queries/actions";

describe("action query keys", () => {
  it("includes limit in list keys to avoid cache collisions", () => {
    expect(actionKeys.list("pending", 50)).not.toEqual(
      actionKeys.list("pending", 100),
    );
  });

  it("keeps different statuses isolated", () => {
    expect(actionKeys.list("pending", 50)).not.toEqual(
      actionKeys.list("approved", 50),
    );
  });
});
