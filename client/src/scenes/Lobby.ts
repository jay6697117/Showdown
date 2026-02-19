import Phaser from "phaser";

export class Lobby extends Phaser.Scene {
  constructor() {
    super("Lobby");
  }

  create() {
    this.add.text(640, 400, "大厅", { fontSize: "48px", color: "#fff" }).setOrigin(0.5);
  }
}
