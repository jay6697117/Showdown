import { createPixelPanel, getTextStyle } from "./theme";

export class AmmoBar {
  maxAmmo: number;
  private text?: Phaser.GameObjects.Text;

  constructor(maxAmmo = 3) {
    this.maxAmmo = maxAmmo;
  }

  attach(scene: Phaser.Scene, x = 16, y = 104): void {
    const panel = createPixelPanel(scene, {
      x: x + 118,
      y: y + 25,
      width: 236,
      height: 52,
      depth: 16,
      scrollFactor: 0,
      fillColor: 0x101e3d,
      strokeColor: 0x69a8ff,
      glowColor: 0x7ce8ff,
      alpha: 0.92,
    });

    this.text = scene.add
      .text(-98, 0, `弹药: ${this.getDisplay(this.maxAmmo).join(" ")}`, getTextStyle("hudBody", { fontSize: "22px", color: "#f3f7ff" }))
      .setOrigin(0, 0.5);
    panel.container.add(this.text);
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
