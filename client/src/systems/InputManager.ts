export class InputManager {
  private keys: Record<string, boolean> = {};
  private aimX = 0;
  private aimY = 0;
  private attackHeld = false;
  private attackPressed = false;
  private superPressed = false;
  private keyDownHandler?: (e: KeyboardEvent) => void;
  private keyUpHandler?: (e: KeyboardEvent) => void;
  private pointerMoveHandler?: (pointer: Phaser.Input.Pointer) => void;
  private pointerDownHandler?: (pointer: Phaser.Input.Pointer) => void;
  private pointerUpHandler?: () => void;

  bindKeys(scene: Phaser.Scene) {
    this.bind(scene);
  }

  bind(scene: Phaser.Scene) {
    this.unbind(scene);

    this.keyDownHandler = (e: KeyboardEvent) => {
      this.keys[e.key.toLowerCase()] = true;
      if (e.key.toLowerCase() === "q") {
        this.superPressed = true;
      }
    };
    this.keyUpHandler = (e: KeyboardEvent) => {
      this.keys[e.key.toLowerCase()] = false;
    };

    scene.input.keyboard?.on("keydown", this.keyDownHandler);
    scene.input.keyboard?.on("keyup", this.keyUpHandler);

    this.pointerMoveHandler = (pointer: Phaser.Input.Pointer) => {
      this.aimX = pointer.worldX;
      this.aimY = pointer.worldY;
    };

    this.pointerDownHandler = (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.superPressed = true;
      } else {
        this.attackPressed = true;
        this.attackHeld = true;
      }
    };

    this.pointerUpHandler = () => {
      this.attackHeld = false;
    };

    scene.input.on("pointermove", this.pointerMoveHandler);
    scene.input.on("pointerdown", this.pointerDownHandler);
    scene.input.on("pointerup", this.pointerUpHandler);

    scene.input.mouse?.disableContextMenu();
  }

  unbind(scene: Phaser.Scene): void {
    if (this.keyDownHandler) {
      scene.input.keyboard?.off("keydown", this.keyDownHandler);
      this.keyDownHandler = undefined;
    }
    if (this.keyUpHandler) {
      scene.input.keyboard?.off("keyup", this.keyUpHandler);
      this.keyUpHandler = undefined;
    }
    if (this.pointerMoveHandler) {
      scene.input.off("pointermove", this.pointerMoveHandler);
      this.pointerMoveHandler = undefined;
    }
    if (this.pointerDownHandler) {
      scene.input.off("pointerdown", this.pointerDownHandler);
      this.pointerDownHandler = undefined;
    }
    if (this.pointerUpHandler) {
      scene.input.off("pointerup", this.pointerUpHandler);
      this.pointerUpHandler = undefined;
    }
    this.keys = {};
    this.aimX = 0;
    this.aimY = 0;
    this.attackHeld = false;
    this.attackPressed = false;
    this.superPressed = false;
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
