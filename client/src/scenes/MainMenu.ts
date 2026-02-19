import Phaser from "phaser";

export class MainMenu extends Phaser.Scene {
  constructor() {
    super("MainMenu");
  }

  create() {
    this.add.text(640, 500, "荒野决斗", { fontSize: "64px", color: "#fff" }).setOrigin(0.5);
    this.add.text(640, 620, "点击开始", { fontSize: "32px", color: "#aaa" }).setOrigin(0.5);

    this.input.once("pointerdown", () => {
      this.scene.start("Lobby");
    });
  }
}
