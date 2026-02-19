import { describe, expect, it } from "vitest";
import { zoneDamagePerSecond } from "../ZoneManager";

describe("ZoneManager", () => {
  it("matches 5-stage damage curve", () => {
    expect(zoneDamagePerSecond(1)).toBe(200);
    expect(zoneDamagePerSecond(2)).toBe(400);
    expect(zoneDamagePerSecond(3)).toBe(600);
    expect(zoneDamagePerSecond(4)).toBe(800);
    expect(zoneDamagePerSecond(5)).toBe(1000);
  });
});
