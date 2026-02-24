import {
  ZONE_MAX_STAGE,
  ZONE_SHRINK_INTERVAL_MS,
  ZONE_START_DELAY_MS,
} from "shared";

const DAMAGE_TABLE = [200, 400, 600, 800, 1000] as const;

export function zoneDamagePerSecond(stage: number): number {
  const index = Math.min(5, Math.max(1, stage)) - 1;
  return DAMAGE_TABLE[index];
}

export class ZoneManager {
  stage = 1;
  radius: number;
  centerX: number;
  centerY: number;
  private shrinkTimer = 0;
  private startTimer = 0;
  private started = false;

  constructor(mapSize: number) {
    this.radius = mapSize / 2;
    this.centerX = mapSize / 2;
    this.centerY = mapSize / 2;
  }

  update(deltaMs: number): void {
    if (!this.started) {
      this.startTimer += deltaMs;
      if (this.startTimer >= ZONE_START_DELAY_MS) {
        this.started = true;
      }
      return;
    }

    this.shrinkTimer += deltaMs;
    if (this.shrinkTimer >= ZONE_SHRINK_INTERVAL_MS && this.stage < ZONE_MAX_STAGE) {
      this.shrinkTimer = 0;
      this.stage++;
      this.radius *= 0.75;
    }
  }

  isOutside(x: number, y: number): boolean {
    const dx = x - this.centerX;
    const dy = y - this.centerY;
    return Math.sqrt(dx * dx + dy * dy) > this.radius;
  }

  getDamagePerSecond(): number {
    return zoneDamagePerSecond(this.stage);
  }

  isStarted(): boolean {
    return this.started;
  }

  getMsUntilStart(): number {
    return this.started ? 0 : Math.max(0, ZONE_START_DELAY_MS - this.startTimer);
  }

  getMsUntilNextShrink(): number {
    if (!this.started || this.stage >= ZONE_MAX_STAGE) {
      return 0;
    }
    return Math.max(0, ZONE_SHRINK_INTERVAL_MS - this.shrinkTimer);
  }

  sync(state: {
    centerX: number;
    centerY: number;
    radius: number;
    stage: number;
    started: boolean;
    msUntilStart: number;
    msUntilNextShrink: number;
  }): void {
    this.centerX = state.centerX;
    this.centerY = state.centerY;
    this.radius = state.radius;
    this.stage = state.stage;
    this.started = state.started;
    this.startTimer = Math.max(0, ZONE_START_DELAY_MS - state.msUntilStart);
    this.shrinkTimer = Math.max(0, ZONE_SHRINK_INTERVAL_MS - state.msUntilNextShrink);
  }
}
