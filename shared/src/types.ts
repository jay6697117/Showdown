/** Shared type definitions */
export type PlayerId = string;

export interface PlayerState {
  id: PlayerId;
  x: number;
  y: number;
  hp: number;
  ammo: number;
  superCharge: number;
  characterId: string;
}

export interface BulletState {
  id: string;
  ownerId: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
}

export interface GameSnapshot {
  tick: number;
  players: PlayerState[];
  bullets: BulletState[];
  zoneStage: number;
  zoneRadius: number;
}
