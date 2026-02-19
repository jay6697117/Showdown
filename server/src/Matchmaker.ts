import { RoomManager } from "./RoomManager";
import { MAX_PLAYERS } from "shared";

export class Matchmaker {
  private queue: string[] = [];

  constructor(private roomManager: RoomManager) {}

  enqueue(playerId: string): string | null {
    if (this.queue.includes(playerId)) return null;
    this.queue.push(playerId);

    if (this.queue.length >= MAX_PLAYERS) {
      const players = this.queue.splice(0, MAX_PLAYERS);
      const room = this.roomManager.createRoom(players[0]);
      for (let i = 1; i < players.length; i++) {
        this.roomManager.joinRoom(room.code, players[i]);
      }
      return room.code;
    }

    return null;
  }

  dequeue(playerId: string): void {
    this.queue = this.queue.filter((id) => id !== playerId);
  }
}
