import { describe, expect, it } from "vitest";
import { RoomManager } from "../RoomManager";

describe("RoomManager", () => {
  it("creates 6-digit room code", () => {
    const manager = new RoomManager();
    const room = manager.createRoom(
      { id: "host-1", name: "Host", characterId: "gunner" },
      "solo"
    );
    expect(room.code).toMatch(/^\d{6}$/);
  });

  it("allows joining a room", () => {
    const manager = new RoomManager();
    const room = manager.createRoom(
      { id: "host-1", name: "Host", characterId: "gunner" },
      "solo"
    );
    const joined = manager.joinRoom(room.code, {
      id: "player-2",
      name: "P2",
      characterId: "bomber",
    });
    expect(joined.ok).toBe(true);
    const found = manager.getRoom(room.code);
    expect(found?.players.some((player) => player.id === "player-2")).toBe(true);
  });

  it("rejects joining non-existent room", () => {
    const manager = new RoomManager();
    const joined = manager.joinRoom("999999", {
      id: "player-2",
      name: "P2",
      characterId: "brawler",
    });
    expect(joined.ok).toBe(false);
  });

  it("assigns duo teams by pairs", () => {
    const manager = new RoomManager();
    const room = manager.createRoom(
      { id: "p1", name: "P1", characterId: "gunner" },
      "duo"
    );

    manager.joinRoom(room.code, { id: "p2", name: "P2", characterId: "bomber" });
    manager.joinRoom(room.code, { id: "p3", name: "P3", characterId: "brawler" });
    manager.joinRoom(room.code, { id: "p4", name: "P4", characterId: "gunner" });

    const found = manager.getRoom(room.code);
    expect(found?.players[0]?.teamId).toBe("T1");
    expect(found?.players[1]?.teamId).toBe("T1");
    expect(found?.players[2]?.teamId).toBe("T2");
    expect(found?.players[3]?.teamId).toBe("T2");
  });
});
