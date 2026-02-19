import { describe, expect, it } from "vitest";
import { chooseBotTarget } from "../BotController";

describe("BotController", () => {
  it("targets nearest player", () => {
    const bot = { x: 0, y: 0 };
    const targets = [
      { id: "far", x: 100, y: 100 },
      { id: "near", x: 10, y: 10 },
    ];
    expect(chooseBotTarget(bot, targets)).toBe("near");
  });

  it("returns null when no targets", () => {
    expect(chooseBotTarget({ x: 0, y: 0 }, [])).toBeNull();
  });
});
