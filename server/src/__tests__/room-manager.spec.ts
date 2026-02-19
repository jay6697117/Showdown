import { describe, expect, it } from "vitest";
import { RoomManager } from "../RoomManager";

describe("RoomManager", () => {
  it("creates 6-digit room code", () => {
    const manager = new RoomManager();
    const room = manager.createRoom("host-1");
    expect(room.code).toMatch(/^\d{6}$/);
  });

  it("allows joining a room", () => {
    const manager = new RoomManager();
    const room = manager.createRoom("host-1");
    const joined = manager.joinRoom(room.code, "player-2");
    expect(joined).toBe(true);
    const found = manager.getRoom(room.code);
    expect(found?.players).toContain("player-2");
  });

  it("rejects joining non-existent room", () => {
    const manager = new RoomManager();
    const joined = manager.joinRoom("999999", "player-2");
    expect(joined).toBe(false);
  });
});
