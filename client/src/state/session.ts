import type { CharacterId, GameMode } from "shared";

export interface LocalPlayerConfig {
  name: string;
  characterId: CharacterId;
}

export interface LobbyPlayer {
  id: string;
  name: string;
  ready: boolean;
  characterId: string;
  teamId: string;
}

export interface LobbyStateData {
  roomCode: string;
  hostId: string;
  mode: GameMode;
  mapId: string;
  players: LobbyPlayer[];
}

export interface MatchStartData {
  roomCode: string;
  hostId: string;
  mapId: string;
  mode: GameMode;
}

export interface ResultData {
  rank: number;
  kills: number;
  damageDone: number;
  cubes: number;
}

export interface SessionState {
  wsUrl: string;
  playerId: string;
  roomCode: string;
  hostId: string;
  mode: GameMode;
  mapId: string;
  localPlayer: LocalPlayerConfig;
  lobbyPlayers: LobbyPlayer[];
  matchStart: MatchStartData | null;
  result: ResultData | null;
}

declare global {
  interface Window {
    __SHOWDOWN_SESSION__?: SessionState;
  }
}

function defaultState(): SessionState {
  return {
    wsUrl: "ws://localhost:3000",
    playerId: "",
    roomCode: "",
    hostId: "",
    mode: "solo",
    mapId: "map-1",
    localPlayer: {
      name: `玩家${Math.floor(Math.random() * 900 + 100)}`,
      characterId: "gunner",
    },
    lobbyPlayers: [],
    matchStart: null,
    result: null,
  };
}

export function getSession(): SessionState {
  if (!window.__SHOWDOWN_SESSION__) {
    window.__SHOWDOWN_SESSION__ = defaultState();
  }
  return window.__SHOWDOWN_SESSION__;
}

export function updateSession(patch: Partial<SessionState>): SessionState {
  const state = getSession();
  const next = { ...state, ...patch };
  window.__SHOWDOWN_SESSION__ = next;
  return next;
}

export function updateLocalPlayer(patch: Partial<LocalPlayerConfig>): SessionState {
  const state = getSession();
  return updateSession({
    localPlayer: {
      ...state.localPlayer,
      ...patch,
    },
  });
}
