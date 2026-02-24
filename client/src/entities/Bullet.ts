export type BulletKind = "normal" | "bomb" | "super";

export interface BulletSpawn {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius?: number;
  ttlMs?: number;
  kind?: BulletKind;
}

export class Bullet {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  ttlMs: number;
  kind: BulletKind;

  constructor(spawn: BulletSpawn) {
    this.id = spawn.id;
    this.ownerId = spawn.ownerId;
    this.x = spawn.x;
    this.y = spawn.y;
    this.vx = spawn.vx;
    this.vy = spawn.vy;
    this.damage = spawn.damage;
    this.radius = spawn.radius ?? 8;
    this.ttlMs = spawn.ttlMs ?? 900;
    this.kind = spawn.kind ?? "normal";
  }

  update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttlMs -= deltaMs;
  }

  isExpired(): boolean {
    return this.ttlMs <= 0;
  }
}
