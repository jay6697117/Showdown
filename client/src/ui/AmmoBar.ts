export class AmmoBar {
  maxAmmo: number;

  constructor(maxAmmo = 3) {
    this.maxAmmo = maxAmmo;
  }

  getDisplay(current: number): string[] {
    const filled = Math.min(current, this.maxAmmo);
    const empty = this.maxAmmo - filled;
    return [...Array(filled).fill("●"), ...Array(empty).fill("○")];
  }
}
