import { createPixelPanel, getTextStyle } from "./theme";

export class AmmoBar {
  maxAmmo: number;
  private text?: Phaser.GameObjects.Text;
  private panel?: import("./theme").PixelPanel;
  private ammoDisplayCache: string[] = [];

  constructor(maxAmmo = 3) {
    this.maxAmmo = maxAmmo;
    this.rebuildDisplayCache();
  }

  attach(scene: Phaser.Scene, x = 16, y = 104): void {
    this.panel = createPixelPanel(scene, {
      x: x + 118,
      y: y + 25,
      width: 236,
      height: 52,
      depth: 16,
      scrollFactor: 0,
      fillColor: 0x0a152a,
      strokeColor: 0x4a90e2,
      glowColor: 0x69a8ff,
      alpha: 0.95,
    });

    this.text = scene.add
      .text(-98, 0, `弹药: ${this.getDisplayText(this.maxAmmo)}`, {
        ...getTextStyle("hudBody", { fontSize: "24px", color: "#ffffff" }),
        fontStyle: "bold",
        stroke: "#050a14",
        strokeThickness: 4
      })
      .setOrigin(0, 0.5);
    this.panel.container.add(this.text);
  }

  private rebuildDisplayCache(): void {
    this.ammoDisplayCache = [];
    for (let ammo = 0; ammo <= this.maxAmmo; ammo++) {
      let display = "";
      for (let slot = 0; slot < this.maxAmmo; slot++) {
        display += slot < ammo ? "●" : "○";
        if (slot < this.maxAmmo - 1) {
          display += " ";
        }
      }
      this.ammoDisplayCache[ammo] = display;
    }
  }

  private getDisplayText(current: number): string {
    const clamped = Math.max(0, Math.min(this.maxAmmo, current));
    return this.ammoDisplayCache[clamped] ?? this.ammoDisplayCache[0] ?? "";
  }

  private lastCurrent = -1;
  private lastIsDanger: boolean | null = null;
  update(current: number, isDanger: boolean = false): void {
    if (!this.text || !this.panel) {
      return;
    }
    if (this.lastCurrent !== current) {
      this.lastCurrent = current;
      this.text.setText(`弹药: ${this.getDisplayText(current)}`);
    }
    if (this.lastIsDanger !== isDanger) {
      this.lastIsDanger = isDanger;
      this.text.setColor(isDanger ? "#ff8888" : "#ffffff");
      this.panel.border.setStrokeStyle(3, isDanger ? 0xff4444 : 0x4a90e2, 1);
      this.panel.body.setFillStyle(isDanger ? 0x3a0a0a : 0x0a152a, 0.95);
    }
}

}
