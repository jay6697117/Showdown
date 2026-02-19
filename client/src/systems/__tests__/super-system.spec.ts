import { describe, expect, it } from "vitest";
import { chargeSuper, isSuperReady } from "../SuperSystem";

describe("SuperSystem", () => {
  it("charges super from dealing damage", () => {
    expect(chargeSuper(0, 500)).toBe(500);
  });

  it("is ready when charge >= threshold", () => {
    expect(isSuperReady(3000)).toBe(true);
    expect(isSuperReady(2999)).toBe(false);
  });
});
