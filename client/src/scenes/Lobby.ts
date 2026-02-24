import Phaser from "phaser";
import type { HostToClientMessage } from "shared";
import { canStartCountdown } from "../ui/LobbyState";
import { getSession, updateSession } from "../state/session";
import { getSignalingClient, resetSignalingClient } from "../state/runtime";

export class Lobby extends Phaser.Scene {
  private titleText?: Phaser.GameObjects.Text;
  private roomText?: Phaser.GameObjects.Text;
  private modeText?: Phaser.GameObjects.Text;
  private mapText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private countdownText?: Phaser.GameObjects.Text;
  private slotTexts: Phaser.GameObjects.Text[] = [];
  private countdownLeftMs = 0;
  private offlineStart = false;

  constructor() {
    super("Lobby");
  }

  create() {
    this.cameras.main.setBackgroundColor("#0b1120");
    this.titleText = this.add.text(640, 56, "等待大厅", {
      fontSize: "48px",
      color: "#f8fafc",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    this.roomText = this.add.text(640, 112, "", {
      fontSize: "22px",
      color: "#cbd5e1",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    this.modeText = this.add.text(640, 144, "", {
      fontSize: "22px",
      color: "#cbd5e1",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    this.mapText = this.add.text(640, 176, "", {
      fontSize: "22px",
      color: "#cbd5e1",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    this.statusText = this.add.text(640, 684, "", {
      fontSize: "18px",
      color: "#fde047",
      fontFamily: "monospace",
      align: "center",
      wordWrap: { width: 1100 },
    }).setOrigin(0.5);

    this.countdownText = this.add.text(640, 640, "", {
      fontSize: "28px",
      color: "#22d3ee",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    for (let i = 0; i < 10; i++) {
      const x = i < 5 ? 330 : 930;
      const y = 240 + (i % 5) * 68;
      const slot = this.add.text(x, y, "", {
        fontSize: "20px",
        color: "#e2e8f0",
        fontFamily: "monospace",
      }).setOrigin(0.5);
      this.slotTexts.push(slot);
    }

    this.createButton(260, 610, "准备 / 取消", () => {
      this.toggleReady();
    });

    this.createButton(500, 610, "切换地图", () => {
      this.toggleMap();
    });

    this.createButton(740, 610, "切换单双排", () => {
      this.toggleMode();
    });

    this.createButton(980, 610, "立即开局", () => {
      this.tryStartMatch(true);
    });

    this.createButton(640, 740, "返回主菜单", () => {
      resetSignalingClient();
      this.scene.start("MainMenu");
    });

    const signaling = getSignalingClient();
    signaling.onMessage = (message: HostToClientMessage) => {
      this.onMessage(message);
    };

    const session = getSession();
    this.offlineStart = session.roomCode === "LOCAL";
    if (this.offlineStart) {
      this.statusText?.setText("离线模式：你可以直接开局，系统会补足9名机器人。\n若要联机，请返回主菜单并先启动 server。\n");
    }

    this.renderSession();
  }

  update(_time: number, delta: number): void {
    const session = getSession();
    const canStart = canStartCountdown(session.lobbyPlayers);

    if (!canStart || session.lobbyPlayers.length < 2) {
      this.countdownLeftMs = 0;
      this.countdownText?.setText("");
      return;
    }

    if (this.countdownLeftMs <= 0) {
      this.countdownLeftMs = 3000;
    }

    this.countdownLeftMs -= delta;
    const sec = Math.ceil(Math.max(0, this.countdownLeftMs) / 1000);
    this.countdownText?.setText(`所有人已准备，${sec} 秒后开始`);

    if (this.countdownLeftMs <= 0) {
      this.tryStartMatch(false);
    }
  }

  private createButton(x: number, y: number, label: string, onClick: () => void): void {
    const bg = this.add.rectangle(x, y, 210, 44, 0x1e293b, 0.95).setStrokeStyle(2, 0x94a3b8, 1).setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, {
      fontSize: "18px",
      color: "#ffffff",
      fontFamily: "monospace",
    }).setOrigin(0.5);
    bg.on("pointerover", () => bg.setFillStyle(0x334155, 1));
    bg.on("pointerout", () => bg.setFillStyle(0x1e293b, 0.95));
    bg.on("pointerdown", () => onClick());
    text.setInteractive({ useHandCursor: true });
    text.on("pointerdown", () => onClick());
  }

  private onMessage(message: HostToClientMessage): void {
    if (message.type === "room-state") {
      updateSession({
        roomCode: message.payload.code,
        hostId: message.payload.hostId,
        mode: message.payload.mode,
        mapId: message.payload.mapId,
        lobbyPlayers: message.payload.players,
      });
      this.renderSession();
      return;
    }

    if (message.type === "match-start") {
      updateSession({
        matchStart: {
          roomCode: message.roomCode,
          hostId: message.hostId,
          mapId: message.mapId,
          mode: message.mode,
        },
      });
      this.scene.start("Game");
      return;
    }

    if (message.type === "error") {
      this.statusText?.setText(`错误: ${message.message}`);
      return;
    }

    if (message.type === "hello") {
      updateSession({ playerId: message.playerId });
      this.renderSession();
    }
  }

  private toggleReady(): void {
    const session = getSession();
    if (session.roomCode === "LOCAL") {
      const players = session.lobbyPlayers.map((item) =>
        item.id === session.playerId ? { ...item, ready: !item.ready } : item
      );
      updateSession({ lobbyPlayers: players });
      this.renderSession();
      return;
    }

    const me = session.lobbyPlayers.find((item) => item.id === session.playerId);
    const nextReady = me ? !me.ready : true;
    getSignalingClient().send({
      type: "ready",
      playerId: session.playerId,
      ready: nextReady,
    });
  }

  private toggleMap(): void {
    const session = getSession();
    if (session.hostId !== session.playerId) {
      this.statusText?.setText("只有房主可以切换地图。");
      return;
    }

    const nextMap = session.mapId === "map-1" ? "map-2" : "map-1";
    if (session.roomCode === "LOCAL") {
      updateSession({ mapId: nextMap });
      this.renderSession();
      return;
    }

    getSignalingClient().send({ type: "select-map", roomCode: session.roomCode, mapId: nextMap });
  }

  private toggleMode(): void {
    const session = getSession();
    if (session.hostId !== session.playerId) {
      this.statusText?.setText("只有房主可以切换单双排。");
      return;
    }

    const nextMode = session.mode === "solo" ? "duo" : "solo";
    if (session.roomCode === "LOCAL") {
      updateSession({ mode: nextMode });
      this.renderSession();
      return;
    }

    getSignalingClient().send({ type: "set-mode", roomCode: session.roomCode, mode: nextMode });
  }

  private tryStartMatch(forceStart: boolean): void {
    const session = getSession();
    if (session.hostId !== session.playerId && !this.offlineStart) {
      return;
    }

    if (!forceStart && !canStartCountdown(session.lobbyPlayers)) {
      return;
    }

    if (session.roomCode === "LOCAL") {
      updateSession({
        matchStart: {
          roomCode: session.roomCode,
          hostId: session.hostId,
          mapId: session.mapId,
          mode: session.mode,
        },
      });
      this.scene.start("Game");
      return;
    }

    getSignalingClient().send({ type: "start-match", roomCode: session.roomCode });
  }

  private renderSession(): void {
    const session = getSession();
    this.roomText?.setText(`房间码: ${session.roomCode || "--"}   房主: ${session.hostId || "--"}`);
    this.modeText?.setText(`模式: ${session.mode === "solo" ? "单排" : "双排"}`);
    this.mapText?.setText(`地图: ${session.mapId}`);

    for (let i = 0; i < 10; i++) {
      const slot = session.lobbyPlayers[i];
      if (!slot) {
        this.slotTexts[i].setText(`${i + 1}. [空位]`).setColor("#64748b");
        continue;
      }
      const me = slot.id === session.playerId ? "(我)" : "";
      const ready = slot.ready ? "已准备" : "未准备";
      const label = `${i + 1}. ${slot.name}${me} [${slot.characterId}] [${slot.teamId}] ${ready}`;
      this.slotTexts[i].setText(label).setColor(slot.ready ? "#86efac" : "#fca5a5");
    }
  }
}
