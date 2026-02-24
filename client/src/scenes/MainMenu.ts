import Phaser from "phaser";
import type { GameMode, HostToClientMessage } from "shared";
import { getAllCharacters } from "../characters";
import { getSession, updateLocalPlayer, updateSession } from "../state/session";
import { getSignalingClient } from "../state/runtime";
import { createPixelButton, createPixelPanel, drawSceneBackdrop, getTextStyle, UI_THEME } from "../ui/theme";

export class MainMenu extends Phaser.Scene {
  private characters = getAllCharacters();
  private selectedCharacterIndex = 0;
  private mode: GameMode = "solo";
  private name = "";
  private hasTransitioned = false;
  private nameText?: Phaser.GameObjects.Text;
  private characterText?: Phaser.GameObjects.Text;
  private modeText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private characterCards: Array<{
    panel: Phaser.GameObjects.Container;
    body: Phaser.GameObjects.Rectangle;
    border: Phaser.GameObjects.Rectangle;
    gloss: Phaser.GameObjects.Rectangle;
    title: Phaser.GameObjects.Text;
    detail: Phaser.GameObjects.Text;
    superText: Phaser.GameObjects.Text;
    badge: Phaser.GameObjects.Text;
    metricFills: Phaser.GameObjects.Rectangle[];
    fillColor: number;
    strokeColor: number;
  }> = [];

  constructor() {
    super("MainMenu");
  }

  create() {
    this.hasTransitioned = false;
    const session = getSession();
    this.name = session.localPlayer.name;
    this.mode = session.mode;
    this.selectedCharacterIndex = Math.max(
      0,
      this.characters.findIndex((item) => item.id === session.localPlayer.characterId)
    );

    drawSceneBackdrop(this, "menu");

    const headerPanel = createPixelPanel(this, {
      x: 640,
      y: 156,
      width: 1120,
      height: 190,
      fillColor: 0x111d3d,
      strokeColor: 0x71d5ff,
      glowColor: 0x5db6ff,
    });
    const title = this.add.text(0, -32, "SHOWDOWN", getTextStyle("title", { fontSize: "64px" })).setOrigin(0.5);
    const subTitle = this.add
      .text(0, 24, "荒野决斗竞技场 / 10人乱斗", getTextStyle("subtitle", { fontSize: "24px", color: "#dce6ff" }))
      .setOrigin(0.5);
    const controlsTip = this.add
      .text(0, 62, "WASD移动  左键攻击  右键或Q释放超级技能", getTextStyle("meta", { color: "#8ed6ff" }))
      .setOrigin(0.5);
    headerPanel.container.add([title, subTitle, controlsTip]);

    this.tweens.add({
      targets: title,
      y: title.y - 4,
      duration: 1200,
      ease: "Sine.InOut",
      yoyo: true,
      repeat: -1,
    });

    const profilePanel = createPixelPanel(this, {
      x: 640,
      y: 366,
      width: 1120,
      height: 172,
      fillColor: 0x101a36,
      strokeColor: 0x5aa7ff,
      glowColor: 0x7bf3d0,
    });

    this.nameText = this.add
      .text(0, -44, "", getTextStyle("body", { fontSize: "30px", color: "#f7f2e9" }))
      .setOrigin(0.5);

    this.characterText = this.add
      .text(0, -2, "", getTextStyle("subtitle", { fontSize: "24px", color: "#d7e5ff" }))
      .setOrigin(0.5);

    this.modeText = this.add
      .text(0, 40, "", getTextStyle("subtitle", { fontSize: "24px", color: "#bcecff" }))
      .setOrigin(0.5);

    profilePanel.container.add([this.nameText, this.characterText, this.modeText]);

    this.add
      .text(640, 426, "点击角色卡片直选角色，条形图展示生存/火力/机动", getTextStyle("meta", { color: "#8ee4ff", fontSize: "20px" }))
      .setOrigin(0.5);

    this.createCharacterCards(500);

    this.createButton(460, 618, "切换角色", () => {
      this.selectedCharacterIndex = (this.selectedCharacterIndex + 1) % this.characters.length;
      this.syncPreview();
    });

    this.createButton(820, 618, "切换模式 (单排/双排)", () => {
      this.mode = this.mode === "solo" ? "duo" : "solo";
      this.syncPreview();
    });

    this.createButton(420, 680, "快速匹配", async () => {
      await this.startOnline("quick-match");
    });

    this.createButton(640, 680, "创建房间", async () => {
      await this.startOnline("create-room");
    });

    this.createButton(860, 680, "加入房间", async () => {
      await this.startOnline("join-room");
    });

    this.createButton(640, 748, "离线练习", () => {
      const currentCharacter = this.characters[this.selectedCharacterIndex];
      updateLocalPlayer({ name: this.name, characterId: currentCharacter.id as "gunner" | "bomber" | "brawler" });
      updateSession({
        playerId: "local-player",
        roomCode: "LOCAL",
        hostId: "local-player",
        mode: this.mode,
        mapId: "map-1",
        lobbyPlayers: [
          {
            id: "local-player",
            name: this.name,
            ready: true,
            characterId: currentCharacter.id,
            teamId: "T1",
          },
        ],
      });
      this.scene.start("Lobby");
    });

    const statusPanel = createPixelPanel(this, {
      x: 640,
      y: 822,
      width: 1120,
      height: 98,
      fillColor: 0x0f1a34,
      strokeColor: 0x6c9fff,
      glowColor: 0x6ee7ff,
    });
    this.statusText = this.add
      .text(
        0,
        0,
        "",
        getTextStyle("meta", {
          fontSize: "18px",
          color: UI_THEME.colors.textWarning,
          wordWrap: { width: 1020 },
          align: "center",
        })
      )
      .setOrigin(0.5);
    statusPanel.container.add(this.statusText);

    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (event.key === "Backspace") {
        this.name = this.name.slice(0, -1);
        this.syncPreview();
        return;
      }
      if (event.key.length === 1 && /[\w\u4e00-\u9fa5]/.test(event.key) && this.name.length < 14) {
        this.name += event.key;
        this.syncPreview();
      }
    });

    this.syncPreview();
  }

  private createButton(x: number, y: number, label: string, onClick: () => void | Promise<void>): void {
    createPixelButton(this, {
      x,
      y,
      label,
      onClick,
      width: 320,
      height: 54,
      fillColor: 0x1e3270,
      strokeColor: 0x79ddff,
      glowColor: 0x72d7ff,
    });
  }

  private createCharacterCards(y: number): void {
    this.characterCards = [];
    const startX = 310;
    const stepX = 330;
    const maxHp = Math.max(...this.characters.map((item) => item.hp));
    const maxDamage = Math.max(...this.characters.map((item) => item.attackDamage));
    const maxSpeed = Math.max(...this.characters.map((item) => item.speed));

    this.characters.forEach((character, index) => {
      const tone = this.getCharacterTone(character.id);
      const panel = createPixelPanel(this, {
        x: startX + stepX * index,
        y,
        width: 300,
        height: 188,
        fillColor: tone.fill,
        strokeColor: tone.stroke,
        glowColor: tone.glow,
        alpha: 0.9,
      });

      const title = this.add
        .text(-8, -66, character.name, getTextStyle("subtitle", { fontSize: "30px", color: tone.title }))
        .setOrigin(0.5);
      const detail = this.add
        .text(0, -34, `HP ${character.hp}  伤害 ${character.attackDamage}`, getTextStyle("meta", { fontSize: "17px", color: "#dbe6ff" }))
        .setOrigin(0.5);
      const superText = this.add
        .text(0, -8, `超级: ${character.superName}`, getTextStyle("meta", { fontSize: "17px", color: "#bed9ff" }))
        .setOrigin(0.5);

      const badge = this.add
        .text(102, -66, "", getTextStyle("meta", { fontSize: "14px", color: "#fff2b6", strokeThickness: 2 }))
        .setOrigin(0.5);

      const metrics: Array<{ label: string; ratio: number; color: number; y: number }> = [
        { label: "生存", ratio: character.hp / maxHp, color: 0x73f0c2, y: 28 },
        { label: "火力", ratio: character.attackDamage / maxDamage, color: 0xffc977, y: 50 },
        { label: "机动", ratio: character.speed / maxSpeed, color: 0x86c6ff, y: 72 },
      ];

      const metricFills: Phaser.GameObjects.Rectangle[] = [];
      for (const metric of metrics) {
        const metricLabel = this.add
          .text(-124, metric.y, metric.label, getTextStyle("meta", { fontSize: "15px", color: "#d2e4ff", strokeThickness: 1 }))
          .setOrigin(0, 0.5);
        const track = this.add
          .rectangle(-54, metric.y, 168, 10, 0x0a1328, 0.86)
          .setOrigin(0, 0.5)
          .setStrokeStyle(1, 0x3f5e8f, 0.9);
        const fill = this.add
          .rectangle(-52, metric.y, Math.max(8, 164 * metric.ratio), 8, metric.color, 0.95)
          .setOrigin(0, 0.5);
        panel.container.add([metricLabel, track, fill]);
        metricFills.push(fill);
      }

      panel.container.add([title, detail, superText, badge]);
      panel.container
        .setSize(300, 188)
        .setInteractive({
          hitArea: new Phaser.Geom.Rectangle(-150, -94, 300, 188),
          hitAreaCallback: Phaser.Geom.Rectangle.Contains,
          useHandCursor: true,
        });

      panel.container.on("pointerdown", () => {
        this.selectedCharacterIndex = index;
        this.syncPreview();
      });
      panel.container.on("pointerover", () => {
        if (this.selectedCharacterIndex !== index) {
          panel.container.setScale(1.02);
        }
      });
      panel.container.on("pointerout", () => {
        if (this.selectedCharacterIndex !== index) {
          panel.container.setScale(1);
        }
      });

      this.characterCards.push({
        panel: panel.container,
        body: panel.body,
        border: panel.border,
        gloss: panel.gloss,
        title,
        detail,
        superText,
        badge,
        metricFills,
        fillColor: tone.fill,
        strokeColor: tone.stroke,
      });
    });
  }

  private getCharacterTone(characterId: string): { fill: number; stroke: number; glow: number; title: string } {
    if (characterId === "gunner") {
      return { fill: 0x12345b, stroke: 0x7bd8ff, glow: 0x7ee5ff, title: "#dff4ff" };
    }
    if (characterId === "bomber") {
      return { fill: 0x573117, stroke: 0xffc385, glow: 0xffde98, title: "#ffeacf" };
    }
    return { fill: 0x4b3a16, stroke: 0xffe08a, glow: 0xfff3aa, title: "#fff2ca" };
  }

  private updateCharacterCardStyles(): void {
    this.characterCards.forEach((card, index) => {
      const selected = index === this.selectedCharacterIndex;
      card.body.setFillStyle(card.fillColor, selected ? 1 : 0.84);
      card.border.setStrokeStyle(selected ? 4 : 2, selected ? 0xffefad : card.strokeColor, 1);
      card.gloss.setFillStyle(selected ? 0xfff0c1 : UI_THEME.colors.buttonStroke, selected ? 0.28 : 0.18);
      card.panel.setScale(selected ? 1.04 : 1);
      card.title.setColor(selected ? "#fff9e3" : "#dce8ff");
      card.detail.setColor(selected ? "#ffedc0" : "#c7d7f6");
      card.superText.setColor(selected ? "#ffe7b5" : "#b4cbf1");
      card.badge.setText(selected ? "已选择" : "");
      card.metricFills.forEach((fill) => {
        fill.setAlpha(selected ? 1 : 0.82);
      });
    });
  }

  private syncPreview(): void {
    if (this.name.trim().length === 0) {
      this.name = "玩家";
    }
    const character = this.characters[this.selectedCharacterIndex];
    this.nameText?.setText(`昵称: ${this.name}  ·  键盘输入 / Backspace删除`);
    this.characterText?.setText(
      `角色: ${character.name}  HP ${character.hp}  伤害 ${character.attackDamage}  超级: ${character.superName}`
    );
    this.modeText?.setText(`模式: ${this.mode === "solo" ? "单排" : "双排"}  ·  点击按钮可快速切换`);
    this.updateCharacterCardStyles();
  }

  private async startOnline(type: "quick-match" | "create-room" | "join-room"): Promise<void> {
    const character = this.characters[this.selectedCharacterIndex];
    const session = updateLocalPlayer({
      name: this.name,
      characterId: character.id as "gunner" | "bomber" | "brawler",
    });

    const signaling = getSignalingClient();
    signaling.onMessage = (message: HostToClientMessage) => {
      this.handleSignalMessage(message);
    };

    try {
      if (!signaling.isConnected()) {
        this.statusText?.setText(`连接服务器中: ${session.wsUrl}`);
        await signaling.connect(session.wsUrl);
      }
    } catch {
      this.statusText?.setText("连接服务器失败，请确认 server 已启动，或使用离线练习。");
      return;
    }

    if (type === "join-room") {
      const code = window.prompt("请输入6位房间码")?.trim();
      if (!code) {
        this.statusText?.setText("已取消加入房间。");
        return;
      }
      signaling.send({
        type,
        code,
        name: this.name,
        characterId: character.id,
      });
      this.statusText?.setText(`加入房间 ${code} ...`);
      return;
    }

    if (type === "create-room") {
      signaling.send({
        type,
        name: this.name,
        characterId: character.id,
        mode: this.mode,
      });
      this.statusText?.setText("创建房间中...");
      return;
    }

    signaling.send({
      type,
      name: this.name,
      characterId: character.id,
      mode: this.mode,
    });
    this.statusText?.setText("快速匹配中...");
  }

  private handleSignalMessage(message: HostToClientMessage): void {
    if (message.type === "hello") {
      updateSession({ playerId: message.playerId });
      return;
    }

    if (message.type === "error") {
      this.statusText?.setText(`错误: ${message.message}`);
      return;
    }

    if (message.type === "room-state") {
      updateSession({
        roomCode: message.payload.code,
        hostId: message.payload.hostId,
        mode: message.payload.mode,
        mapId: message.payload.mapId,
        lobbyPlayers: message.payload.players,
      });

      if (!this.hasTransitioned) {
        this.hasTransitioned = true;
        this.scene.start("Lobby");
      }
    }
  }
}
