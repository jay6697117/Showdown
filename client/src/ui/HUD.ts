export function formatAliveCounter(alive: number, total: number): string {
  return `存活: ${alive}/${total}`;
}

export class HUD {
  private aliveText: Phaser.GameObjects.Text;
  private zoneText: Phaser.GameObjects.Text;
  private statusText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.aliveText = scene.add.text(16, 16, formatAliveCounter(10, 10), {
      fontSize: "24px",
      color: "#ffffff",
      fontFamily: "monospace",
    });
    this.aliveText.setScrollFactor(0).setDepth(10);

    this.zoneText = scene.add.text(16, 44, "毒圈: 准备中", {
      fontSize: "20px",
      color: "#ffde59",
      fontFamily: "monospace",
    });
    this.zoneText.setScrollFactor(0).setDepth(10);

    this.statusText = scene.add.text(16, 72, "", {
      fontSize: "18px",
      color: "#9ee1ff",
      fontFamily: "monospace",
    });
    this.statusText.setScrollFactor(0).setDepth(10);
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
