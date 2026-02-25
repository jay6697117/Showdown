import { MAP_SIZE } from "shared";
import { getTextStyle, UI_THEME } from "./theme";

export class MiniMap {
  width: number;
  height: number;
  private bgGraphics?: Phaser.GameObjects.Graphics;
  private zoneGraphics?: Phaser.GameObjects.Graphics;
  private playerGraphics?: Phaser.GameObjects.Graphics;
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
    this.lastSignature = undefined;
    this.lastZoneSignature = undefined;

    this.bgGraphics = scene.add.graphics();
    this.bgGraphics.setScrollFactor(0).setDepth(16);
    
    this.zoneGraphics = scene.add.graphics();
    this.zoneGraphics.setScrollFactor(0).setDepth(16.1);

    this.playerGraphics = scene.add.graphics();
    this.playerGraphics.setScrollFactor(0).setDepth(16.2);

    this.title = scene.add
      .text(this.x + this.width / 2, this.y - 14, "战术小地图", getTextStyle("meta", { fontSize: "16px", color: "#d6e8ff" }))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(16.3);

    this.drawStatic();
  }

  private drawStatic(): void {
    if (!this.bgGraphics) return;
    this.bgGraphics.clear();
    this.bgGraphics.fillStyle(UI_THEME.colors.overlayShadow, 0.45);
    this.bgGraphics.fillRect(this.x + 4, this.y + 5, this.width, this.height);
    this.bgGraphics.fillStyle(UI_THEME.colors.panelBase, 0.95);
    this.bgGraphics.fillRect(this.x, this.y, this.width, this.height);
    this.bgGraphics.fillStyle(0x18315b, 0.8);
    this.bgGraphics.fillRect(this.x + 6, this.y + 6, this.width - 12, this.height - 12);

    this.bgGraphics.lineStyle(1, 0x88a3dd, 0.12);
    for (let i = 1; i < 6; i++) {
      const gridX = this.x + (this.width / 6) * i;
      const gridY = this.y + (this.height / 6) * i;
      this.bgGraphics.beginPath();
      this.bgGraphics.moveTo(gridX, this.y + 6);
      this.bgGraphics.lineTo(gridX, this.y + this.height - 6);
      this.bgGraphics.strokePath();
      this.bgGraphics.beginPath();
      this.bgGraphics.moveTo(this.x + 6, gridY);
      this.bgGraphics.lineTo(this.x + this.width - 6, gridY);
      this.bgGraphics.strokePath();
    }
  }

  private lastSignature?: number;
  private lastZoneSignature?: number;

  draw(params: {
    players: Array<{ x: number; y: number; teamId: string; isSelf: boolean }>;
    zone: { centerX: number; centerY: number; radius: number };
    selfTeam?: string;
    isOutsideZone: boolean;
    signature?: number;
  }): void {
    if (!this.zoneGraphics || !this.playerGraphics) {
      return;
    }

    if (params.signature !== undefined && this.lastSignature === params.signature) {
      return;
    }
    this.lastSignature = params.signature;

    const selfTeam = params.selfTeam;
    const isOutsideZone = params.isOutsideZone;
    const scaleX = this.width / MAP_SIZE;
    const scaleY = this.height / MAP_SIZE;

    let zoneSignature = 0;
    zoneSignature = (zoneSignature * 31 + Math.round(params.zone.centerX)) | 0;
    zoneSignature = (zoneSignature * 31 + Math.round(params.zone.centerY)) | 0;
    zoneSignature = (zoneSignature * 31 + Math.round(params.zone.radius)) | 0;
    zoneSignature = (zoneSignature * 31 + (isOutsideZone ? 1 : 0)) | 0;

    if (this.lastZoneSignature !== zoneSignature) {
      this.lastZoneSignature = zoneSignature;
      this.zoneGraphics.clear();

      if (isOutsideZone) {
        this.zoneGraphics.fillStyle(0xff0000, 0.25);
        this.zoneGraphics.fillRect(this.x + 6, this.y + 6, this.width - 12, this.height - 12);
      }

      this.zoneGraphics.lineStyle(3, isOutsideZone ? 0xff4444 : UI_THEME.colors.minimapFrame, 1);
      this.zoneGraphics.strokeRect(this.x, this.y, this.width, this.height);
      this.zoneGraphics.lineStyle(1, isOutsideZone ? 0xff8888 : 0xc8e8ff, 0.6);
      this.zoneGraphics.strokeRect(this.x + 6, this.y + 6, this.width - 12, this.height - 12);

      const zoneX = this.x + params.zone.centerX * scaleX;
      const zoneY = this.y + params.zone.centerY * scaleY;
      const zoneRadius = params.zone.radius * scaleX;
      this.zoneGraphics.lineStyle(3, 0xff4444, 0.9);
      this.zoneGraphics.strokeCircle(zoneX, zoneY, zoneRadius);
      this.zoneGraphics.lineStyle(1, 0xffaaaa, 0.5);
      this.zoneGraphics.strokeCircle(zoneX, zoneY, Math.max(0, zoneRadius - 2));
    }

    this.playerGraphics.clear();
    for (let i = 0; i < params.players.length; i++) {
      const player = params.players[i];
      const px = this.x + player.x * scaleX;
      const py = this.y + player.y * scaleY;
      if (player.isSelf) {
        this.playerGraphics.fillStyle(0x44ff99, 1);
        this.playerGraphics.fillCircle(px, py, 5);
        this.playerGraphics.lineStyle(2, 0xffffff, 1);
        this.playerGraphics.strokeCircle(px, py, 6.5);
        
        if (isOutsideZone) {
          this.playerGraphics.lineStyle(2, 0xff0000, 0.8);
          this.playerGraphics.strokeCircle(px, py, 10);
        }
      } else if (player.teamId === selfTeam) {
        this.playerGraphics.fillStyle(0x44bbff, 1);
        this.playerGraphics.fillCircle(px, py, 3.5);
        this.playerGraphics.lineStyle(1, 0xffffff, 0.9);
        this.playerGraphics.strokeCircle(px, py, 4.5);
      } else {
        this.playerGraphics.fillStyle(0xff5544, 1);
        this.playerGraphics.fillCircle(px, py, 3.5);
        this.playerGraphics.lineStyle(1, 0xffffff, 0.9);
        this.playerGraphics.strokeCircle(px, py, 4.5);
      }
    }
  }
}
