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
  private readonly shrinkIntervalMs = 15000;

  constructor(mapSize: number) {
    this.radius = mapSize / 2;
    this.centerX = mapSize / 2;
    this.centerY = mapSize / 2;
  }

  update(deltaMs: number): void {
    this.shrinkTimer += deltaMs;
    if (this.shrinkTimer >= this.shrinkIntervalMs && this.stage < 5) {
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
}
