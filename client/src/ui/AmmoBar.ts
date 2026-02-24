export class AmmoBar {
  maxAmmo: number;
  private text?: Phaser.GameObjects.Text;

  constructor(maxAmmo = 3) {
    this.maxAmmo = maxAmmo;
  }

  attach(scene: Phaser.Scene, x = 16, y = 104): void {
    this.text = scene.add.text(x, y, this.getDisplay(this.maxAmmo).join(" "), {
      fontSize: "22px",
      color: "#ffffff",
      fontFamily: "monospace",
    });
    this.text.setScrollFactor(0).setDepth(10);
  }

  getDisplay(current: number): string[] {
    const filled = Math.min(current, this.maxAmmo);
    const empty = this.maxAmmo - filled;
    return [...Array(filled).fill("●"), ...Array(empty).fill("○")];
  }

  update(current: number): void {
    if (!this.text) {
      return;
    }
    this.text.setText(`弹药: ${this.getDisplay(current).join(" ")}`);
  }
}
