export { GAME_TICK_RATE } from "./constants";
import type { GameMode, GameSnapshot } from "./types";

export type InputPacket = {
  seq: number;
  dx: number;
  dy: number;
  attack: boolean;
  skill: boolean;
  aimX: number;
  aimY: number;
};

export type ClientToHostMessage =
  | { type: "input"; playerId: string; payload: InputPacket }
  | { type: "ready"; playerId: string; ready: boolean }
  | { type: "select-map"; roomCode: string; mapId: string }
  | { type: "set-mode"; roomCode: string; mode: GameMode }
  | { type: "start-match"; roomCode: string }
  | { type: "create-room"; name: string; characterId: string; mode: GameMode }
  | { type: "join-room"; code: string; name: string; characterId: string }
  | { type: "quick-match"; name: string; characterId: string; mode: GameMode }
  | { type: "offer" | "answer" | "ice-candidate"; target: string; payload: unknown };

export type HostToClientMessage =
  | { type: "snapshot"; payload: GameSnapshot }
  | { type: "room-state"; payload: RoomStatePayload }
  | { type: "match-start"; roomCode: string; hostId: string; mapId: string; mode: GameMode }
  | { type: "error"; message: string }
  | { type: "hello"; playerId: string }
  | { type: "signal"; from: string; signalType: "offer" | "answer" | "ice-candidate"; payload: unknown };

export type RoomPlayerPayload = {
  id: string;
  name: string;
  ready: boolean;
  characterId: string;
  teamId: string;
};

export type RoomStatePayload = {
  code: string;
  hostId: string;
  mode: GameMode;
  mapId: string;
  players: RoomPlayerPayload[];
};

export function encodeInputPacket(input: InputPacket): string {
  return JSON.stringify(input);
}

export function decodeInputPacket(raw: string): InputPacket {
  return JSON.parse(raw) as InputPacket;
}

export function encodeSnapshot(snapshot: GameSnapshot): string {
  return JSON.stringify(snapshot);
}

export function decodeSnapshot(raw: string): GameSnapshot {
  return JSON.parse(raw) as GameSnapshot;
}
