export class InputManager {
  private keys: Record<string, boolean> = {};
  private aimX = 0;
  private aimY = 0;

  bindKeys(scene: Phaser.Scene) {
    scene.input.keyboard!.on("keydown", (e: KeyboardEvent) => {
      this.keys[e.key.toLowerCase()] = true;
    });
    scene.input.keyboard!.on("keyup", (e: KeyboardEvent) => {
      this.keys[e.key.toLowerCase()] = false;
    });
    scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.aimX = pointer.worldX;
      this.aimY = pointer.worldY;
    });
  }

  getDx(): number {
    const left = this.keys["a"] ? -1 : 0;
    const right = this.keys["d"] ? 1 : 0;
    return left + right;
  }

  getDy(): number {
    const up = this.keys["w"] ? -1 : 0;
    const down = this.keys["s"] ? 1 : 0;
    return up + down;
  }

  isAttacking(): boolean {
    return this.keys[" "] || false;
  }

  getAim(): { aimX: number; aimY: number } {
    return { aimX: this.aimX, aimY: this.aimY };
  }
}
