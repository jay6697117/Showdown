import Phaser from "phaser";
import type { GameMode, HostToClientMessage } from "shared";
import { getAllCharacters } from "../characters";
import { getSession, updateLocalPlayer, updateSession } from "../state/session";
import { getSignalingClient } from "../state/runtime";

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

    this.cameras.main.setBackgroundColor("#0f172a");
    this.add.text(640, 110, "荒野决斗 - Showdown", {
      fontSize: "56px",
      color: "#f8fafc",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    this.add.text(640, 170, "WASD移动 / 左键攻击 / 右键或Q释放超级技能", {
      fontSize: "20px",
      color: "#93c5fd",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    this.nameText = this.add.text(640, 250, "", {
      fontSize: "28px",
      color: "#ffffff",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    this.characterText = this.add.text(640, 300, "", {
      fontSize: "24px",
      color: "#e2e8f0",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    this.modeText = this.add.text(640, 340, "", {
      fontSize: "24px",
      color: "#e2e8f0",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    this.createButton(640, 400, "切换角色", () => {
      this.selectedCharacterIndex = (this.selectedCharacterIndex + 1) % this.characters.length;
      this.syncPreview();
    });

    this.createButton(640, 455, "切换模式 (单排/双排)", () => {
      this.mode = this.mode === "solo" ? "duo" : "solo";
      this.syncPreview();
    });

    this.createButton(420, 540, "快速匹配", async () => {
      await this.startOnline("quick-match");
    });

    this.createButton(640, 540, "创建房间", async () => {
      await this.startOnline("create-room");
    });

    this.createButton(860, 540, "加入房间", async () => {
      await this.startOnline("join-room");
    });

    this.createButton(640, 610, "离线练习", () => {
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

    this.statusText = this.add.text(640, 690, "", {
      fontSize: "18px",
      color: "#facc15",
      fontFamily: "monospace",
      wordWrap: { width: 980 },
      align: "center",
    }).setOrigin(0.5);

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
    const bg = this.add.rectangle(x, y, 260, 42, 0x1e293b, 0.95).setStrokeStyle(2, 0x60a5fa, 1).setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, {
      fontSize: "20px",
      color: "#f8fafc",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    bg.on("pointerover", () => bg.setFillStyle(0x334155, 1));
    bg.on("pointerout", () => bg.setFillStyle(0x1e293b, 0.95));
    bg.on("pointerdown", () => {
      void onClick();
    });

    text.setInteractive({ useHandCursor: true });
    text.on("pointerdown", () => {
      void onClick();
    });
  }

  private syncPreview(): void {
    if (this.name.trim().length === 0) {
      this.name = "玩家";
    }
    const character = this.characters[this.selectedCharacterIndex];
    this.nameText?.setText(`昵称: ${this.name}  (键盘输入, Backspace删除)`);
    this.characterText?.setText(
      `角色: ${character.name}  HP ${character.hp}  伤害 ${character.attackDamage}  超级: ${character.superName}`
    );
    this.modeText?.setText(`模式: ${this.mode === "solo" ? "单排" : "双排"}`);
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
