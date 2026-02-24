import { MAP_SIZE } from "shared";
import { getTextStyle, UI_THEME } from "./theme";

export class MiniMap {
  width: number;
  height: number;
  private graphics?: Phaser.GameObjects.Graphics;
  private title?: Phaser.GameObjects.Text;
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
    this.graphics.setScrollFactor(0).setDepth(16);
    this.title = scene.add
      .text(this.x + this.width / 2, this.y - 14, "战术小地图", getTextStyle("meta", { fontSize: "16px", color: "#d6e8ff" }))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(16);
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
    this.graphics.fillStyle(UI_THEME.colors.overlayShadow, 0.45);
    this.graphics.fillRect(this.x + 4, this.y + 5, this.width, this.height);
    this.graphics.fillStyle(UI_THEME.colors.panelBase, 0.95);
    this.graphics.fillRect(this.x, this.y, this.width, this.height);
    this.graphics.fillStyle(0x18315b, 0.8);
    this.graphics.fillRect(this.x + 6, this.y + 6, this.width - 12, this.height - 12);

    this.graphics.lineStyle(3, UI_THEME.colors.minimapFrame, 1);
    this.graphics.strokeRect(this.x, this.y, this.width, this.height);
    this.graphics.lineStyle(1, 0xc8e8ff, 0.6);
    this.graphics.strokeRect(this.x + 6, this.y + 6, this.width - 12, this.height - 12);

    this.graphics.lineStyle(1, 0x88a3dd, 0.12);
    for (let i = 1; i < 6; i++) {
      const gridX = this.x + (this.width / 6) * i;
      const gridY = this.y + (this.height / 6) * i;
      this.graphics.beginPath();
      this.graphics.moveTo(gridX, this.y + 6);
      this.graphics.lineTo(gridX, this.y + this.height - 6);
      this.graphics.strokePath();
      this.graphics.beginPath();
      this.graphics.moveTo(this.x + 6, gridY);
      this.graphics.lineTo(this.x + this.width - 6, gridY);
      this.graphics.strokePath();
    }

    const zoneCenter = this.worldToMiniMap(params.zone.centerX, params.zone.centerY, MAP_SIZE);
    const zoneRadius = (params.zone.radius / MAP_SIZE) * this.width;
    this.graphics.lineStyle(2, 0xff7f7f, 0.95);
    this.graphics.strokeCircle(this.x + zoneCenter.x, this.y + zoneCenter.y, zoneRadius);

    const selfTeam = params.players.find((item) => item.isSelf)?.teamId;

    for (const player of params.players) {
      if (!player.alive) {
        continue;
      }
      const point = this.worldToMiniMap(player.x, player.y, MAP_SIZE);
      const color = player.isSelf ? 0x72ffc1 : player.teamId === selfTeam ? 0x88d6ff : 0xffd98e;
      this.graphics.fillStyle(color, 1);
      this.graphics.fillCircle(this.x + point.x, this.y + point.y, player.isSelf ? 4.5 : 3.2);
      if (player.isSelf) {
        this.graphics.lineStyle(1, 0xffffff, 0.85);
        this.graphics.strokeCircle(this.x + point.x, this.y + point.y, 6);
      }
    }
  }
}
