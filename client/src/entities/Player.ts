import { AMMO_MAX, AMMO_REGEN_MS, POWER_CUBE_HP_BONUS, POWER_CUBE_MAX, SUPER_CHARGE_MAX } from "shared";
import type { CharacterId } from "shared";

export interface PlayerSpawn {
  id: string;
  name: string;
  x: number;
  y: number;
  characterId: CharacterId;
  baseHp: number;
  speed: number;
  teamId: string;
  isBot: boolean;
}

export class Player {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  ammo: number;
  superCharge: number;
  speed: number;
  cubes: number;
  kills: number;
  damageDone: number;
  characterId: CharacterId;
  teamId: string;
  alive: boolean;
  isBot: boolean;
  invulnerableMs: number;
  private ammoElapsedMs: number;

  constructor(spawn: PlayerSpawn) {
    this.id = spawn.id;
    this.name = spawn.name;
    this.x = spawn.x;
    this.y = spawn.y;
    this.hp = spawn.baseHp;
    this.maxHp = spawn.baseHp;
    this.ammo = AMMO_MAX;
    this.superCharge = 0;
    this.speed = spawn.speed;
    this.cubes = 0;
    this.kills = 0;
    this.damageDone = 0;
    this.characterId = spawn.characterId;
    this.teamId = spawn.teamId;
    this.alive = true;
    this.isBot = spawn.isBot;
    this.invulnerableMs = 0;
    this.ammoElapsedMs = 0;
  }

  update(deltaMs: number): void {
    if (!this.alive) {
      return;
    }

    if (this.invulnerableMs > 0) {
      this.invulnerableMs = Math.max(0, this.invulnerableMs - deltaMs);
    }

    if (this.ammo < AMMO_MAX) {
      this.ammoElapsedMs += deltaMs;
      while (this.ammoElapsedMs >= AMMO_REGEN_MS && this.ammo < AMMO_MAX) {
        this.ammoElapsedMs -= AMMO_REGEN_MS;
        this.ammo += 1;
      }
    }
  }

  consumeAmmo(): boolean {
    if (!this.alive || this.ammo <= 0) {
      return false;
    }
    this.ammo -= 1;
    return true;
  }

  addSuperCharge(value: number): void {
    this.superCharge = Math.min(SUPER_CHARGE_MAX, this.superCharge + value);
  }

  consumeSuper(): boolean {
    if (this.superCharge < SUPER_CHARGE_MAX) {
      return false;
    }
    this.superCharge = 0;
    return true;
  }

  addPowerCube(count = 1): void {
    const next = Math.min(POWER_CUBE_MAX, this.cubes + count);
    const gained = next - this.cubes;
    this.cubes = next;
    this.maxHp += POWER_CUBE_HP_BONUS * gained;
    this.hp += POWER_CUBE_HP_BONUS * gained;
  }

  takeDamage(amount: number): boolean {
    if (!this.alive || this.invulnerableMs > 0) {
      return false;
    }
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      return true;
    }
    return false;
  }
}
