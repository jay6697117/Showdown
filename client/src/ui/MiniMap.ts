import { MAP_SIZE } from "shared";

export class MiniMap {
  width: number;
  height: number;
  private graphics?: Phaser.GameObjects.Graphics;
  private x: number;
  private y: number;

  constructor(width = 180, height = 180, x = 1080, y = 16) {
    this.width = width;
    this.height = height;
    this.x = x;
    this.y = y;
  }

  attach(scene: Phaser.Scene): void {
    this.graphics = scene.add.graphics();
    this.graphics.setScrollFactor(0).setDepth(10);
  }

  worldToMiniMap(
    worldX: number,
    worldY: number,
    mapSize: number
  ): { x: number; y: number } {
    return {
      x: (worldX / mapSize) * this.width,
      y: (worldY / mapSize) * this.height,
    };
  }

  draw(params: {
    players: Array<{ x: number; y: number; teamId: string; alive: boolean; isSelf: boolean }>;
    zone: { centerX: number; centerY: number; radius: number };
  }): void {
    if (!this.graphics) {
      return;
    }

    this.graphics.clear();
    this.graphics.fillStyle(0x101828, 0.75);
    this.graphics.fillRect(this.x, this.y, this.width, this.height);
    this.graphics.lineStyle(2, 0xffffff, 0.9);
    this.graphics.strokeRect(this.x, this.y, this.width, this.height);

    const zoneCenter = this.worldToMiniMap(params.zone.centerX, params.zone.centerY, MAP_SIZE);
    const zoneRadius = (params.zone.radius / MAP_SIZE) * this.width;
    this.graphics.lineStyle(1, 0xff5a5a, 1);
    this.graphics.strokeCircle(this.x + zoneCenter.x, this.y + zoneCenter.y, zoneRadius);

    for (const player of params.players) {
      if (!player.alive) {
        continue;
      }
      const point = this.worldToMiniMap(player.x, player.y, MAP_SIZE);
      const color = player.isSelf ? 0x65ff9d : player.teamId === "A" ? 0x75c5ff : 0xffe17a;
      this.graphics.fillStyle(color, 1);
      this.graphics.fillCircle(this.x + point.x, this.y + point.y, player.isSelf ? 4 : 3);
    }
  }
}
