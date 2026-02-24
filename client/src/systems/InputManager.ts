export class InputManager {
  private keys: Record<string, boolean> = {};
  private aimX = 0;
  private aimY = 0;
  private attackHeld = false;
  private attackPressed = false;
  private superPressed = false;

  bindKeys(scene: Phaser.Scene) {
    this.bind(scene);
  }

  bind(scene: Phaser.Scene) {
    scene.input.keyboard!.on("keydown", (e: KeyboardEvent) => {
      this.keys[e.key.toLowerCase()] = true;
      if (e.key.toLowerCase() === "q") {
        this.superPressed = true;
      }
    });
    scene.input.keyboard!.on("keyup", (e: KeyboardEvent) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.aimX = pointer.worldX;
      this.aimY = pointer.worldY;
    });

    scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.superPressed = true;
      } else {
        this.attackPressed = true;
        this.attackHeld = true;
      }
    });

    scene.input.on("pointerup", () => {
      this.attackHeld = false;
    });

    scene.input.mouse?.disableContextMenu();
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
    return this.keys[" "] || this.attackHeld;
  }

  consumeAttackPressed(): boolean {
    const pressed = this.attackPressed || this.keys[" "] || false;
    this.attackPressed = false;
    return pressed;
  }

  consumeSuperPressed(): boolean {
    const pressed = this.superPressed;
    this.superPressed = false;
    return pressed;
  }

  getAim(): { aimX: number; aimY: number } {
    return { aimX: this.aimX, aimY: this.aimY };
  }
}
