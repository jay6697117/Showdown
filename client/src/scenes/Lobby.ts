import Phaser from "phaser";
import type { ClientToHostMessage, HostToClientMessage } from "shared";
import { canStartCountdown } from "../ui/LobbyState";
import { getSession, updateSession } from "../state/session";
import { getSignalingClient, resetSignalingClient } from "../state/runtime";
import { createPixelButton, createPixelPanel, drawSceneBackdrop, getTextStyle, UI_THEME } from "../ui/theme";
import type { PixelPanel } from "../ui/theme";

export class Lobby extends Phaser.Scene {
  private titleText?: Phaser.GameObjects.Text;
  private roomText?: Phaser.GameObjects.Text;
  private modeText?: Phaser.GameObjects.Text;
  private mapText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private countdownText?: Phaser.GameObjects.Text;
  private teamBoardText?: Phaser.GameObjects.Text;
  private slotTexts: Phaser.GameObjects.Text[] = [];
  private slotPanels: PixelPanel[] = [];
  private countdownLeftMs = 0;
  private offlineStart = false;
  private hasTransitioned = false;
  private startMatchRequested = false;
  private signalingHandler?: (message: HostToClientMessage) => void;

  constructor() {
    super("Lobby");
  }

  create() {
    this.hasTransitioned = false;
    this.startMatchRequested = false;
    drawSceneBackdrop(this, "lobby");

    const headerPanel = createPixelPanel(this, {
      x: 640,
      y: 108,
      width: 1140,
      height: 180,
      fillColor: 0x111c3c,
      strokeColor: 0x6fd1ff,
      glowColor: 0x88ffe8,
    });

    this.titleText = this.add.text(0, -42, "等待大厅", getTextStyle("title", { fontSize: "52px" })).setOrigin(0.5);

    this.roomText = this.add.text(0, 8, "", getTextStyle("subtitle", { fontSize: "24px" })).setOrigin(0.5);

    this.modeText = this.add
      .text(-220, 46, "", getTextStyle("meta", { color: "#b7d7ff", fontSize: "21px" }))
      .setOrigin(0.5);

    this.mapText = this.add
      .text(220, 46, "", getTextStyle("meta", { color: "#b7d7ff", fontSize: "21px" }))
      .setOrigin(0.5);

    headerPanel.container.add([this.titleText, this.roomText, this.modeText, this.mapText]);

    const leftPanel = createPixelPanel(this, {
      x: 334,
      y: 420,
      width: 504,
      height: 394,
      fillColor: 0x0f1a35,
      strokeColor: 0x6ca8ff,
      glowColor: 0x8effda,
    });
    const rightPanel = createPixelPanel(this, {
      x: 946,
      y: 420,
      width: 504,
      height: 394,
      fillColor: 0x0f1a35,
      strokeColor: 0x6ca8ff,
      glowColor: 0x8effda,
    });

    leftPanel.container.add(
      this.add.text(0, -166, "队列 A (1-5)", getTextStyle("subtitle", { color: "#bff7ff", fontSize: "22px" })).setOrigin(0.5)
    );
    rightPanel.container.add(
      this.add.text(0, -166, "队列 B (6-10)", getTextStyle("subtitle", { color: "#bff7ff", fontSize: "22px" })).setOrigin(0.5)
    );

    this.statusText = this.add
      .text(
        640,
        734,
        "",
        getTextStyle("meta", {
          fontSize: "19px",
          color: UI_THEME.colors.textWarning,
          align: "center",
          wordWrap: { width: 1100 },
        })
      )
      .setOrigin(0.5);

    this.countdownText = this.add
      .text(640, 688, "", getTextStyle("body", { fontSize: "30px", color: "#87f8ff" }))
      .setOrigin(0.5);

    const teamPanel = createPixelPanel(this, {
      x: 640,
      y: 652,
      width: 1120,
      height: 58,
      fillColor: 0x101f40,
      strokeColor: 0x699be5,
      glowColor: 0x91ffd7,
      alpha: 0.9,
    });
    this.teamBoardText = this.add
      .text(
        0,
        0,
        "",
        getTextStyle("meta", {
          fontSize: "17px",
          color: "#c6dcff",
          align: "center",
          wordWrap: { width: 1040 },
        })
      )
      .setOrigin(0.5);
    teamPanel.container.add(this.teamBoardText);

    for (let i = 0; i < 10; i++) {
      const x = i < 5 ? 330 : 930;
      const y = 278 + (i % 5) * 68;
      const slotPanel = createPixelPanel(this, {
        x,
        y,
        width: 460,
        height: 56,
        fillColor: 0x132246,
        strokeColor: 0x5870a8,
        glowColor: 0x7ec8ff,
        alpha: 0.82,
      });
      const slot = this.add
        .text(0, 0, "", getTextStyle("meta", { fontSize: "18px", color: "#dce4ff" }))
        .setOrigin(0.5);
      slotPanel.container.add(slot);
      this.slotTexts.push(slot);
      this.slotPanels.push(slotPanel);
    }

    this.createButton(220, 610, "准备 / 取消", () => {
      this.toggleReady();
    });

    this.createButton(500, 610, "切换地图", () => {
      this.toggleMap();
    });

    this.createButton(780, 610, "切换单双排", () => {
      this.toggleMode();
    });

    this.createButton(1060, 610, "立即开局", () => {
      this.tryStartMatch(true);
    });

    this.createButton(640, 792, "返回主菜单", () => {
      this.hasTransitioned = true;
      resetSignalingClient();
      this.scene.start("MainMenu");
    });

    const signaling = getSignalingClient();
    this.signalingHandler = (message: HostToClientMessage) => {
      this.onMessage(message);
    };
    signaling.onMessage = this.signalingHandler;

    this.events.once("shutdown", () => {
      this.hasTransitioned = true;
      this.startMatchRequested = false;
      const sig = getSignalingClient();
      if (sig.onMessage === this.signalingHandler) {
        sig.onMessage = () => {};
      }
      this.signalingHandler = undefined;
    });

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
      this.startMatchRequested = false;
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
    const isDanger = label.includes("返回");
    createPixelButton(this, {
      x,
      y,
      label,
      onClick,
      width: isDanger ? 320 : 250,
      height: 52,
      fillColor: isDanger ? UI_THEME.colors.buttonDanger : 0x1e3270,
      strokeColor: isDanger ? UI_THEME.colors.buttonDangerStroke : 0x79ddff,
      glowColor: isDanger ? 0xffa3c6 : 0x72d7ff,
    });
  }

  private onMessage(message: HostToClientMessage): void {
    if (this.hasTransitioned || !this.scene.isActive(this.scene.key)) {
      return;
    }

    if (message.type === "room-state") {
      const allReady = canStartCountdown(message.payload.players);
      if (!allReady) {
        this.startMatchRequested = false;
      }
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
      if (!this.hasTransitioned) {
        this.hasTransitioned = true;
        this.scene.start("Game");
      }
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

  private async sendOnlineMessage(message: ClientToHostMessage, statusText?: string): Promise<boolean> {
    const signaling = getSignalingClient();
    const session = getSession();

    if (!signaling.isConnected()) {
      this.statusText?.setText(`连接服务器中: ${session.wsUrl}`);
      try {
        await signaling.connect(session.wsUrl);
      } catch {
        this.statusText?.setText("连接已断开，请返回主菜单后重试。");
        return false;
      }
    }

    if (this.hasTransitioned || !this.scene.isActive(this.scene.key)) {
      return false;
    }

    signaling.send(message);
    if (statusText) {
      this.statusText?.setText(statusText);
    }
    return true;
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
    void this.sendOnlineMessage(
      {
        type: "ready",
        playerId: session.playerId,
        ready: nextReady,
      },
      `准备状态已切换: ${nextReady ? "已准备" : "未准备"}`
    );
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

    void this.sendOnlineMessage(
      { type: "select-map", roomCode: session.roomCode, mapId: nextMap },
      `请求切换地图至 ${nextMap} ...`
    );
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

    void this.sendOnlineMessage(
      { type: "set-mode", roomCode: session.roomCode, mode: nextMode },
      `请求切换模式至 ${nextMode === "solo" ? "单排" : "双排"} ...`
    );
  }

  private tryStartMatch(forceStart: boolean): void {
    if (this.hasTransitioned) {
      return;
    }

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
      this.hasTransitioned = true;
      this.scene.start("Game");
      return;
    }

    if (this.startMatchRequested) {
      return;
    }

    this.startMatchRequested = true;
    void this.sendOnlineMessage({ type: "start-match", roomCode: session.roomCode }, "发送开局请求...").then((sent) => {
      if (!sent) {
        this.startMatchRequested = false;
      }
    });
  }

  private renderSession(): void {
    const session = getSession();
    this.roomText?.setText(`房间码: ${session.roomCode || "--"}   房主: ${session.hostId || "--"}`);
    this.modeText?.setText(`模式: ${session.mode === "solo" ? "单排" : "双排"}`);
    this.mapText?.setText(`地图: ${session.mapId}`);
    this.renderTeamBoard(session.mode, session.lobbyPlayers);

    for (let i = 0; i < 10; i++) {
      const slot = session.lobbyPlayers[i];
      const panel = this.slotPanels[i];
      if (!slot) {
        this.styleSlotPanel(panel, { occupied: false, ready: false, isSelf: false });
        this.slotTexts[i].setText(`${i + 1}. [空位]`).setColor("#6f82ad");
        continue;
      }
      const isSelf = slot.id === session.playerId;
      const me = isSelf ? "★我" : "";
      const ready = slot.ready ? "已准备" : "未准备";
      const label = `${i + 1}. ${slot.name}${me} [${slot.characterId}] [${slot.teamId}] ${ready}`;
      this.styleSlotPanel(panel, { occupied: true, ready: slot.ready, isSelf });
      if (isSelf) {
        this.slotTexts[i].setText(label).setColor(slot.ready ? "#fff2c4" : "#ffe0ea");
      } else {
        this.slotTexts[i].setText(label).setColor(slot.ready ? "#7ef4be" : "#ff9fb1");
      }
    }
  }

  private styleSlotPanel(
    panel: PixelPanel,
    state: { occupied: boolean; ready: boolean; isSelf: boolean }
  ): void {
    if (!state.occupied) {
      panel.body.setFillStyle(0x101d3a, 0.64);
      panel.border.setStrokeStyle(2, 0x4d628f, 0.8);
      panel.gloss.setFillStyle(0x8cbfff, 0.08);
      panel.container.setScale(1);
      return;
    }

    if (state.isSelf) {
      panel.body.setFillStyle(state.ready ? 0x3b3518 : 0x40222e, 0.95);
      panel.border.setStrokeStyle(3, state.ready ? 0xf6d47b : 0xffb7c7, 1);
      panel.gloss.setFillStyle(state.ready ? 0xfff0b4 : 0xffd4df, 0.2);
      panel.container.setScale(1.02);
      return;
    }

    if (state.ready) {
      panel.body.setFillStyle(0x143d30, 0.92);
      panel.border.setStrokeStyle(2, 0x5ddaa4, 1);
      panel.gloss.setFillStyle(0x9cfed1, 0.2);
      panel.container.setScale(1);
      return;
    }

    panel.body.setFillStyle(0x3d2032, 0.9);
    panel.border.setStrokeStyle(2, 0xff96b4, 1);
    panel.gloss.setFillStyle(0xffb5ca, 0.18);
    panel.container.setScale(1);
  }

  private renderTeamBoard(
    mode: "solo" | "duo",
    players: Array<{ id: string; name: string; teamId: string; ready: boolean }>
  ): void {
    if (!this.teamBoardText) {
      return;
    }

    if (players.length === 0) {
      this.teamBoardText.setText("等待玩家加入...").setColor("#8ea5cc");
      return;
    }

    if (mode === "solo") {
      const readyCount = players.filter((item) => item.ready).length;
      this.teamBoardText
        .setText(`单排模式：每位玩家独立作战  ·  准备进度 ${readyCount}/${players.length}`)
        .setColor(readyCount === players.length ? "#90f4bf" : "#cfe0ff");
      return;
    }

    const grouped = new Map<string, Array<{ name: string; ready: boolean }>>();
    for (const player of players) {
      const list = grouped.get(player.teamId) ?? [];
      list.push({ name: player.name, ready: player.ready });
      grouped.set(player.teamId, list);
    }

    const parts = [...grouped.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "en"))
      .map(([teamId, members]) => {
        const allReady = members.every((member) => member.ready);
        const names = members.map((member) => `${member.name}${member.ready ? "✓" : "○"}`).join("/");
        return `${teamId}[${allReady ? "就绪" : "待命"}]: ${names}`;
      });

    const fullReady = players.every((item) => item.ready);
    this.teamBoardText
      .setText(`双排队伍  ·  ${parts.join("   |   ")}`)
      .setColor(fullReady ? "#90f4bf" : "#cfe0ff");
  }
}
