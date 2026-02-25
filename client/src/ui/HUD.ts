export function formatAliveCounter(alive: number, total: number): string {
  return `存活: ${alive}/${total}`;
}

export class HUD {
  private aliveText: Phaser.GameObjects.Text;
  private zoneText: Phaser.GameObjects.Text;
  private statusText: Phaser.GameObjects.Text;
  private border: Phaser.GameObjects.Rectangle;
  private body: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    const panel = scene.add.container(216, 76).setDepth(16).setScrollFactor(0);
    const shadow = scene.add.rectangle(6, 7, 420, 128, 0x000000, 0.65).setOrigin(0.5);
    this.body = scene.add.rectangle(0, 0, 420, 128, 0x0a152a, 0.95).setOrigin(0.5);
    const inner = scene.add
      .rectangle(0, 0, 410, 118, 0x132850, 0.26)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0xffffff, 0.08);
    const topGlow = scene.add.rectangle(0, -56, 404, 10, 0x96fff1, 0.2).setOrigin(0.5);
    this.border = scene.add.rectangle(0, 0, 420, 128).setOrigin(0.5).setStrokeStyle(3, 0x70d3ff, 1);

    this.aliveText = scene.add
      .text(-186, -40, formatAliveCounter(10, 10), {
        fontSize: "26px",
        fontStyle: "bold",
        fontFamily: '"Rajdhani", "Noto Sans SC", "Microsoft YaHei", sans-serif',
        color: "#ffffff",
        stroke: "#050a14",
        strokeThickness: 5,
      })
      .setOrigin(0, 0.5);
    this.zoneText = scene.add
      .text(-186, -6, "毒圈: 准备中", {
        fontSize: "20px",
        fontStyle: "bold",
        fontFamily: '"JetBrains Mono", "Cascadia Mono", "Consolas", monospace',
        color: "#ffebaa",
        stroke: "#050a14",
        strokeThickness: 4,
      })
      .setOrigin(0, 0.5);
    this.statusText = scene.add
      .text(-186, 28, "", {
        fontSize: "18px",
        fontStyle: "bold",
        fontFamily: '"JetBrains Mono", "Cascadia Mono", "Consolas", monospace',
        color: "#cceeff",
        stroke: "#050a14",
        strokeThickness: 4,
      })
      .setOrigin(0, 0.5);

    panel.add([shadow, this.body, inner, topGlow, this.border, this.aliveText, this.zoneText, this.statusText]);
  }

  private lastAlive = -1;
  private lastTotal = -1;
  private lastZoneText = "";
  private lastStatusText = "";
  private lastIsDanger: boolean | null = null;
  updateAlive(alive: number, total: number): void {
    if (this.lastAlive === alive && this.lastTotal === total) return;
    this.lastAlive = alive;
    this.lastTotal = total;
    this.aliveText.setText(formatAliveCounter(alive, total));
  }
  updateZone(text: string): void {
    if (this.lastZoneText === text) return;
    this.lastZoneText = text;
    this.zoneText.setText(text);
  }
  updateStatus(text: string, isDanger: boolean = false): void {
    if (this.lastStatusText !== text) {
      this.lastStatusText = text;
      this.statusText.setText(text);
    }
    if (this.lastIsDanger !== isDanger) {
      this.lastIsDanger = isDanger;
      this.statusText.setColor(isDanger ? "#ff8888" : "#cceeff");
      this.border.setStrokeStyle(3, isDanger ? 0xff4444 : 0x70d3ff, 1);
      this.body.setFillStyle(isDanger ? 0x3a0a0a : 0x0a152a, 0.95);
    }
}

}