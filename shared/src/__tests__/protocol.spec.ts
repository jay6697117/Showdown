import { describe, expect, it } from "vitest";
import {
  encodeInputPacket,
  decodeInputPacket,
  GAME_TICK_RATE,
  encodeSnapshot,
  decodeSnapshot,
} from "../protocol";
import type { GameSnapshot } from "../types";

describe("protocol", () => {
  it("encodes/decodes input packets symmetrically", () => {
    const input = { seq: 1, dx: 1, dy: 0, attack: true, skill: false, aimX: 200, aimY: 180 };
    const encoded = encodeInputPacket(input);
    expect(decodeInputPacket(encoded)).toEqual(input);
  });

  it("uses 20 tick authoritative rate", () => {
    expect(GAME_TICK_RATE).toBe(20);
  });

  it("encodes and decodes snapshots", () => {
    const snapshot: GameSnapshot = {
      tick: 4,
      elapsedMs: 200,
      players: [
        {
          id: "p1",
          name: "A",
          x: 100,
          y: 200,
          hp: 3200,
          maxHp: 3200,
          ammo: 3,
          superCharge: 0,
          cubes: 0,
          kills: 0,
          damageDone: 0,
          alive: true,
          characterId: "gunner",
          teamId: "T1",
        },
      ],
      bullets: [],
      zone: {
        centerX: 640,
        centerY: 640,
        radius: 640,
        stage: 1,
        started: false,
        msUntilStart: 30000,
        msUntilNextShrink: 10000,
      },
      aliveCount: 1,
    };
    const encoded = encodeSnapshot(snapshot);
    expect(decodeSnapshot(encoded)).toEqual(snapshot);
  });
});
