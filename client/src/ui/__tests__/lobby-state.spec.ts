import { describe, expect, it } from "vitest";
import { canStartCountdown } from "../LobbyState";

describe("LobbyState", () => {
  it("starts when all joined players are ready", () => {
    expect(canStartCountdown([{ id: "a", ready: true }, { id: "b", ready: true }])).toBe(true);
  });

  it("does not start when a player is not ready", () => {
    expect(canStartCountdown([{ id: "a", ready: true }, { id: "b", ready: false }])).toBe(false);
  });

  it("does not start with only one player", () => {
    expect(canStartCountdown([{ id: "a", ready: true }])).toBe(false);
  });
});
