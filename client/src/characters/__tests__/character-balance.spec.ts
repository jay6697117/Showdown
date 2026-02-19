import { describe, expect, it } from "vitest";
import { GUNNER, BOMBER, BRAWLER } from "../index";

describe("character balance", () => {
  it("keeps triangle baseline stats", () => {
    expect(GUNNER.hp).toBe(3200);
    expect(BOMBER.hp).toBe(2800);
    expect(BRAWLER.hp).toBe(4800);
  });

  it("all have 3 max ammo", () => {
    expect(GUNNER.ammoMax).toBe(3);
    expect(BOMBER.ammoMax).toBe(3);
    expect(BRAWLER.ammoMax).toBe(3);
  });
});
