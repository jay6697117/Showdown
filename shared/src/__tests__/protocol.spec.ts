import { describe, expect, it } from "vitest";
import { encodeInputPacket, decodeInputPacket, GAME_TICK_RATE } from "../protocol";

describe("protocol", () => {
  it("encodes/decodes input packets symmetrically", () => {
    const input = { seq: 1, dx: 1, dy: 0, attack: true, skill: false, aimX: 200, aimY: 180 };
    const encoded = encodeInputPacket(input);
    expect(decodeInputPacket(encoded)).toEqual(input);
  });

  it("uses 20 tick authoritative rate", () => {
    expect(GAME_TICK_RATE).toBe(20);
  });
});
