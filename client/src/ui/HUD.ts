export function formatAliveCounter(alive: number, total: number): string {
  return `存活: ${alive}/${total}`;
}

export class HUD {
  private aliveText: Phaser.GameObjects.Text;
  private zoneText: Phaser.GameObjects.Text;
  private statusText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const panel = scene.add.container(216, 76).setDepth(16).setScrollFactor(0);
    const shadow = scene.add.rectangle(6, 7, 420, 128, 0x070c17, 0.52).setOrigin(0.5);
    const body = scene.add.rectangle(0, 0, 420, 128, 0x0f1d3a, 0.92).setOrigin(0.5);
    const inner = scene.add
      .rectangle(0, 0, 410, 118, 0x132850, 0.26)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0xffffff, 0.08);
    const topGlow = scene.add.rectangle(0, -56, 404, 10, 0x96fff1, 0.2).setOrigin(0.5);
    const border = scene.add.rectangle(0, 0, 420, 128).setOrigin(0.5).setStrokeStyle(3, 0x70d3ff, 1);

    this.aliveText = scene.add
      .text(-186, -40, formatAliveCounter(10, 10), {
        fontSize: "24px",
        fontFamily: '"Rajdhani", "Noto Sans SC", "Microsoft YaHei", sans-serif',
        color: "#fff4d8",
        stroke: "#0c142a",
        strokeThickness: 4,
      })
      .setOrigin(0, 0.5);
    this.zoneText = scene.add
      .text(-186, -6, "毒圈: 准备中", {
        fontSize: "20px",
        fontFamily: '"JetBrains Mono", "Cascadia Mono", "Consolas", monospace',
        color: "#ffe08a",
        stroke: "#0c142a",
        strokeThickness: 3,
      })
      .setOrigin(0, 0.5);
    this.statusText = scene.add
      .text(-186, 28, "", {
        fontSize: "18px",
        fontFamily: '"JetBrains Mono", "Cascadia Mono", "Consolas", monospace',
        color: "#a4eaff",
        stroke: "#0c142a",
        strokeThickness: 3,
      })
      .setOrigin(0, 0.5);

    panel.add([shadow, body, inner, topGlow, border, this.aliveText, this.zoneText, this.statusText]);
  }

  updateAlive(alive: number, total: number): void {
    this.aliveText.setText(formatAliveCounter(alive, total));
  }

  updateZone(text: string): void {
    this.zoneText.setText(text);
  }

  updateStatus(text: string): void {
    this.statusText.setText(text);
  }
}
