import { beforeEach, describe, expect, it } from "vitest";
import { getSession, updateLocalPlayer, updateSession } from "../state/session";

describe("showdown flow", () => {
  beforeEach(() => {
    delete window.__SHOWDOWN_SESSION__;
  });

  it("starts from menu config and enters lobby", () => {
    const initial = getSession();
    expect(initial.roomCode).toBe("");

    updateLocalPlayer({ name: "Alice", characterId: "gunner" });
    const state = updateSession({
      playerId: "p1",
      roomCode: "123456",
      hostId: "p1",
      mode: "solo",
      mapId: "map-1",
      lobbyPlayers: [
        { id: "p1", name: "Alice", ready: true, characterId: "gunner", teamId: "T1" },
        { id: "p2", name: "Bob", ready: true, characterId: "bomber", teamId: "T2" },
      ],
    });

    expect(state.localPlayer.name).toBe("Alice");
    expect(state.roomCode).toBe("123456");
    expect(state.lobbyPlayers).toHaveLength(2);
  });

  it("stores result payload after match", () => {
    updateSession({
      playerId: "p1",
      roomCode: "LOCAL",
      hostId: "p1",
      mode: "solo",
      mapId: "map-1",
      lobbyPlayers: [],
      result: {
        rank: 1,
        kills: 4,
        damageDone: 5600,
        cubes: 7,
      },
    });

    const state = getSession();
    expect(state.result?.rank).toBe(1);
    expect(state.result?.kills).toBe(4);
    expect(state.result?.damageDone).toBe(5600);
    expect(state.result?.cubes).toBe(7);
  });
});
