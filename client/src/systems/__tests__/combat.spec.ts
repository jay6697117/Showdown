import { describe, expect, it } from "vitest";
import { regenAmmo, consumeAmmo } from "../CombatSystem";

describe("CombatSystem ammo", () => {
  it("regenerates one ammo every 2 seconds up to 3", () => {
    expect(regenAmmo({ ammo: 1, elapsedMs: 2000 })).toBe(2);
    expect(regenAmmo({ ammo: 3, elapsedMs: 4000 })).toBe(3);
  });

  it("consumes one ammo on attack", () => {
    expect(consumeAmmo(3)).toBe(2);
  });
});
