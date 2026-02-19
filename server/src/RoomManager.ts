export interface Room {
  code: string;
  hostId: string;
  players: string[];
  ready: Set<string>;
}

export class RoomManager {
  private rooms = new Map<string, Room>();

  createRoom(hostId: string): Room {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const room: Room = { code, hostId, players: [hostId], ready: new Set<string>() };
    this.rooms.set(code, room);
    return room;
  }

  joinRoom(code: string, playerId: string): boolean {
    const room = this.rooms.get(code);
    if (!room) return false;
    if (room.players.includes(playerId)) return false;
    room.players.push(playerId);
    return true;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  setReady(code: string, playerId: string): void {
    const room = this.rooms.get(code);
    if (room) room.ready.add(playerId);
  }

  removeRoom(code: string): void {
    this.rooms.delete(code);
  }
}
