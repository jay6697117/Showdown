import Phaser from "phaser";
import { getSession, updateSession } from "../state/session";
import { resetSignalingClient } from "../state/runtime";
import { createPixelButton, createPixelPanel, drawSceneBackdrop, getTextStyle, UI_THEME } from "../ui/theme";

export class Result extends Phaser.Scene {
  constructor() {
    super("Result");
  }

  create() {
    drawSceneBackdrop(this, "result");
    const result = getSession().result;

    const stagePanel = createPixelPanel(this, {
      x: 640,
      y: 286,
      width: 1050,
      height: 400,
      fillColor: 0x201936,
      strokeColor: 0xf2b155,
      glowColor: 0xffef9a,
      alpha: 0.95,
    });

    const title = this.add
      .text(0, -146, "战斗结算", getTextStyle("title", { fontSize: "58px", color: "#fff3d9" }))
      .setOrigin(0.5);

    const rank = this.add
      .text(0, -66, `排名: #${result?.rank ?? 10}`, getTextStyle("title", { fontSize: "44px", color: "#ffd166" }))
      .setOrigin(0.5);

    const kills = this.add
      .text(-210, 20, `击杀\n${result?.kills ?? 0}`, getTextStyle("body", { align: "center", color: "#f8f4e7", fontSize: "30px" }))
      .setOrigin(0.5);

    const damage = this.add
      .text(0, 20, `伤害\n${result?.damageDone ?? 0}`, getTextStyle("body", { align: "center", color: "#f8f4e7", fontSize: "30px" }))
      .setOrigin(0.5);

    const cubes = this.add
      .text(210, 20, `能量块\n${result?.cubes ?? 0}`, getTextStyle("body", { align: "center", color: "#f8f4e7", fontSize: "30px" }))
      .setOrigin(0.5);

    const summary = this.add
      .text(0, 120, this.buildSummary(result?.rank ?? 10), getTextStyle("subtitle", { color: "#ffe4b6", fontSize: "24px" }))
      .setOrigin(0.5);

    stagePanel.container.add([title, rank, kills, damage, cubes, summary]);

    this.tweens.add({
      targets: rank,
      scaleX: 1.04,
      scaleY: 1.04,
      duration: 700,
      ease: "Sine.InOut",
      yoyo: true,
      repeat: -1,
    });

    this.createButton(500, 556, "再来一局", () => {
      updateSession({ result: null, matchStart: null });
      this.scene.start("Game");
    });

    this.createButton(780, 556, "返回主菜单", () => {
      updateSession({ result: null, matchStart: null, lobbyPlayers: [], roomCode: "", hostId: "" });
      resetSignalingClient();
      this.scene.start("MainMenu");
    });
  }

  private createButton(x: number, y: number, label: string, onClick: () => void): void {
    const isDanger = label.includes("返回");
    createPixelButton(this, {
      x,
      y,
      label,
      onClick,
      width: 260,
      height: 58,
      fillColor: isDanger ? UI_THEME.colors.buttonDanger : 0x5f3a1c,
      strokeColor: isDanger ? UI_THEME.colors.buttonDangerStroke : 0xffd27a,
      glowColor: isDanger ? 0xff95b5 : 0xfff2a1,
      textColor: "#fff7e7",
      fontSize: "22px",
    });
  }

  private buildSummary(rank: number): string {
    if (rank === 1) {
      return "全场制霸！你就是本局 MVP";
    }

    if (rank <= 3) {
      return "表现亮眼，距离冠军只差一步";
    }

    return "继续推进节奏，下局冲击前3";
  }
}
