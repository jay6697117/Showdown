import Phaser from "phaser";
import { getSession, updateSession } from "../state/session";
import { resetSignalingClient } from "../state/runtime";

export class Result extends Phaser.Scene {
  constructor() {
    super("Result");
  }

  create() {
    this.cameras.main.setBackgroundColor("#111827");
    const result = getSession().result;

    this.add.text(640, 150, "战斗结算", {
      fontSize: "56px",
      color: "#f8fafc",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    this.add.text(640, 270, `排名: #${result?.rank ?? 10}`, {
      fontSize: "42px",
      color: "#fcd34d",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    this.add.text(640, 340, `击杀: ${result?.kills ?? 0}`, {
      fontSize: "28px",
      color: "#ffffff",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    this.add.text(640, 390, `造成伤害: ${result?.damageDone ?? 0}`, {
      fontSize: "28px",
      color: "#ffffff",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    this.add.text(640, 440, `能量块: ${result?.cubes ?? 0}`, {
      fontSize: "28px",
      color: "#ffffff",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    this.createButton(520, 560, "再来一局", () => {
      updateSession({ result: null, matchStart: null });
      this.scene.start("Game");
    });

    this.createButton(760, 560, "返回主菜单", () => {
      updateSession({ result: null, matchStart: null, lobbyPlayers: [], roomCode: "", hostId: "" });
      resetSignalingClient();
      this.scene.start("MainMenu");
    });
  }

  private createButton(x: number, y: number, label: string, onClick: () => void): void {
    const bg = this.add.rectangle(x, y, 220, 48, 0x1e293b, 0.95).setStrokeStyle(2, 0x93c5fd, 1).setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, {
      fontSize: "22px",
      color: "#ffffff",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    bg.on("pointerover", () => bg.setFillStyle(0x334155, 1));
    bg.on("pointerout", () => bg.setFillStyle(0x1e293b, 0.95));
    bg.on("pointerdown", () => onClick());
    text.setInteractive({ useHandCursor: true });
    text.on("pointerdown", () => onClick());
  }
}
