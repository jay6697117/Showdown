import { describe, expect, it } from "vitest";
import { computeAliveCount, getWinner } from "../MatchState";

describe("MatchState", () => {
  it("returns winner when only one player remains", () => {
    const players = [
      { id: "p1", hp: 100 },
      { id: "p2", hp: 0 },
    ];
    expect(computeAliveCount(players)).toBe(1);
    expect(getWinner(players)).toBe("p1");
  });

  it("returns null when multiple players alive", () => {
    const players = [
      { id: "p1", hp: 100 },
      { id: "p2", hp: 50 },
    ];
    expect(computeAliveCount(players)).toBe(2);
    expect(getWinner(players)).toBeNull();
  });

  it("returns null when no players alive", () => {
    const players = [
      { id: "p1", hp: 0 },
      { id: "p2", hp: 0 },
    ];
    expect(computeAliveCount(players)).toBe(0);
    expect(getWinner(players)).toBeNull();
  });
});
