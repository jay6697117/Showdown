import Phaser from "phaser";

export class Result extends Phaser.Scene {
  constructor() {
    super("Result");
  }

  create() {
    this.add.text(640, 400, "结算", { fontSize: "48px", color: "#fff" }).setOrigin(0.5);
  }
}
