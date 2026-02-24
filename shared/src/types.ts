export type PlayerId = string;
export type CharacterId = "gunner" | "bomber" | "brawler";
export type GameMode = "solo" | "duo";

export interface PlayerState {
  id: PlayerId;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  ammo: number;
  superCharge: number;
  cubes: number;
  kills: number;
  damageDone: number;
  alive: boolean;
  characterId: CharacterId;
  teamId: string;
}

export interface BulletState {
  id: string;
  ownerId: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  ttlMs: number;
  kind: "normal" | "bomb" | "super";
}

export interface ZoneState {
  centerX: number;
  centerY: number;
  radius: number;
  stage: number;
  started: boolean;
  msUntilStart: number;
  msUntilNextShrink: number;
}

export interface GameSnapshot {
  tick: number;
  elapsedMs: number;
  players: PlayerState[];
  bullets: BulletState[];
  zone: ZoneState;
  aliveCount: number;
}

export interface MatchResult {
  playerId: PlayerId;
  rank: number;
  kills: number;
  damageDone: number;
  cubes: number;
}
