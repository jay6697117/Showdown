import { MAX_PLAYERS } from "shared";
import type { GameMode, RoomPlayerPayload, RoomStatePayload } from "shared";

export interface RoomPlayer {
  id: string;
  name: string;
  characterId: string;
  ready: boolean;
  teamId: string;
}

export interface Room {
  code: string;
  hostId: string;
  mode: GameMode;
  mapId: string;
  players: RoomPlayer[];
}

export interface PlayerProfile {
  id: string;
  name: string;
  characterId: string;
}

export class RoomManager {
  private rooms = new Map<string, Room>();

  createRoom(host: PlayerProfile, mode: GameMode): Room {
    const code = this.generateRoomCode();
    const room: Room = {
      code,
      hostId: host.id,
      mode,
      mapId: "map-1",
      players: [
        {
          id: host.id,
          name: host.name,
          characterId: host.characterId,
          ready: false,
          teamId: "T1",
        },
      ],
    };
    this.assignTeams(room);
    this.rooms.set(code, room);
    return room;
  }

  joinRoom(code: string, profile: PlayerProfile): { ok: boolean; reason?: string } {
    const room = this.rooms.get(code);
    if (!room) {
      return { ok: false, reason: "房间不存在" };
    }
    if (room.players.some((player) => player.id === profile.id)) {
      return { ok: false, reason: "玩家已在房间中" };
    }
    if (room.players.length >= MAX_PLAYERS) {
      return { ok: false, reason: "房间已满" };
    }

    room.players.push({
      id: profile.id,
      name: profile.name,
      characterId: profile.characterId,
      ready: false,
      teamId: "",
    });
    this.assignTeams(room);
    return { ok: true };
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  getRoomByPlayer(playerId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.some((player) => player.id === playerId)) {
        return room;
      }
    }
    return undefined;
  }

  findJoinableRoom(mode: GameMode): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.mode !== mode) {
        continue;
      }
      if (room.players.length >= MAX_PLAYERS) {
        continue;
      }
      return room;
    }
    return undefined;
  }

  setReady(code: string, playerId: string, ready: boolean): boolean {
    const room = this.rooms.get(code);
    if (!room) {
      return false;
    }
    const player = room.players.find((item) => item.id === playerId);
    if (!player) {
      return false;
    }
    player.ready = ready;
    return true;
  }

  setMode(code: string, mode: GameMode, operatorId: string): boolean {
    const room = this.rooms.get(code);
    if (!room || room.hostId !== operatorId) {
      return false;
    }
    room.mode = mode;
    for (const player of room.players) {
      player.ready = false;
    }
    this.assignTeams(room);
    return true;
  }

  setMap(code: string, mapId: string, operatorId: string): boolean {
    const room = this.rooms.get(code);
    if (!room || room.hostId !== operatorId) {
      return false;
    }
    room.mapId = mapId;
    return true;
  }

  canStart(code: string): boolean {
    const room = this.rooms.get(code);
    if (!room) {
      return false;
    }
    return room.players.length >= 2 && room.players.every((player) => player.ready);
  }

  removePlayer(playerId: string): Room[] {
    const affected: Room[] = [];
    for (const room of this.rooms.values()) {
      const before = room.players.length;
      room.players = room.players.filter((player) => player.id !== playerId);
      if (room.players.length === before) {
        continue;
      }
      if (room.players.length === 0) {
        this.rooms.delete(room.code);
        continue;
      }
      if (room.hostId === playerId) {
        room.hostId = room.players[0].id;
      }
      this.assignTeams(room);
      affected.push(room);
    }
    return affected;
  }

  toPayload(room: Room): RoomStatePayload {
    return {
      code: room.code,
      hostId: room.hostId,
      mode: room.mode,
      mapId: room.mapId,
      players: room.players.map((player) => this.playerToPayload(player)),
    };
  }

  private playerToPayload(player: RoomPlayer): RoomPlayerPayload {
    return {
      id: player.id,
      name: player.name,
      ready: player.ready,
      characterId: player.characterId,
      teamId: player.teamId,
    };
  }

  private assignTeams(room: Room): void {
    if (room.mode === "solo") {
      for (let i = 0; i < room.players.length; i++) {
        room.players[i].teamId = `T${i + 1}`;
      }
      return;
    }
    for (let i = 0; i < room.players.length; i++) {
      room.players[i].teamId = `T${Math.floor(i / 2) + 1}`;
    }
  }

  private generateRoomCode(): string {
    let code = "";
    do {
      code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (this.rooms.has(code));
    return code;
  }
}
