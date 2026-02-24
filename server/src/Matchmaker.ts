import { RoomManager } from "./RoomManager";
import { MAX_PLAYERS } from "shared";
import type { GameMode } from "shared";
import type { PlayerProfile, Room } from "./RoomManager";

export class Matchmaker {
  private queueByMode: Record<GameMode, PlayerProfile[]> = {
    solo: [],
    duo: [],
  };

  constructor(private roomManager: RoomManager) {}

  enqueue(profile: PlayerProfile, mode: GameMode): Room | null {
    this.dequeue(profile.id);

    const queue = this.queueByMode[mode];
    if (queue.some((item) => item.id === profile.id)) {
      return null;
    }

    queue.push(profile);

    if (queue.length >= MAX_PLAYERS) {
      const players = queue.splice(0, MAX_PLAYERS);
      const room = this.roomManager.createRoom(players[0], mode);
      for (let i = 1; i < players.length; i++) {
        this.roomManager.joinRoom(room.code, players[i]);
      }
      return room;
    }

    return null;
  }

  dequeue(playerId: string): void {
    this.queueByMode.solo = this.queueByMode.solo.filter((item) => item.id !== playerId);
    this.queueByMode.duo = this.queueByMode.duo.filter((item) => item.id !== playerId);
  }

  getQueueSize(mode: GameMode): number {
    return this.queueByMode[mode].length;
  }
}
