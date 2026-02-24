import { describe, expect, it } from "vitest";
import { chargeSuper, chargeSuperFromHit, isSuperReady } from "../SuperSystem";

describe("SuperSystem", () => {
  it("charges super from dealing damage", () => {
    expect(chargeSuper(0, 40)).toBe(40);
  });

  it("is ready when charge >= threshold", () => {
    expect(isSuperReady(100)).toBe(true);
    expect(isSuperReady(99)).toBe(false);
  });

  it("charges by 20 per hit", () => {
    expect(chargeSuperFromHit(0, 1)).toBe(20);
    expect(chargeSuperFromHit(80, 2)).toBe(100);
  });
});
