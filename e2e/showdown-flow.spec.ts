import { describe, expect, it } from "vitest";
import { GAME_TICK_RATE, decodeInputPacket, encodeInputPacket } from "shared";

describe("showdown protocol flow", () => {
  it("keeps 20 tick and input symmetry", () => {
    expect(GAME_TICK_RATE).toBe(20);

    const input = {
      seq: 11,
      dx: 1,
      dy: -1,
      attack: true,
      skill: false,
      aimX: 640,
      aimY: 360,
    };

    const encoded = encodeInputPacket(input);
    expect(decodeInputPacket(encoded)).toEqual(input);
  });
});
