import Phaser from "phaser";
import { AMMO_MAX, GAME_TICK_RATE, MAP_SIZE, MAX_PLAYERS, ZONE_SHRINK_INTERVAL_MS, ZONE_START_DELAY_MS } from "shared";
import { decodeInputPacket, decodeSnapshot, encodeInputPacket, encodeSnapshot } from "shared";
import type { GameSnapshot, InputPacket, PlayerState, BulletState, HostToClientMessage } from "shared";
import { getAllCharacters, getCharacterById } from "../characters";
import { Bullet } from "../entities/Bullet";
import { Crate } from "../entities/Crate";
import { Player } from "../entities/Player";
import { PowerCube } from "../entities/PowerCube";
import { computeBotInput } from "../systems/BotController";
import { computeDamage } from "../systems/CombatSystem";
import { computeRank } from "../systems/MatchState";
import { InputManager } from "../systems/InputManager";
import { ZoneManager } from "../systems/ZoneManager";
import { AmmoBar } from "../ui/AmmoBar";
import { HUD } from "../ui/HUD";
import { MiniMap } from "../ui/MiniMap";
import { createPixelPanel, getTextStyle, UI_THEME } from "../ui/theme";
import { Sfx } from "../audio/Sfx";
import { HostAuthority } from "../network/HostLogic";
import { PeerManager } from "../network/PeerManager";
import { SnapshotBuffer } from "../network/ClientSync";
import { getSession, updateSession } from "../state/session";
import { getSignalingClient } from "../state/runtime";

const QUALITY_STORAGE_KEY = "showdown_quality_pref";
const ADAPTIVE_DOWNGRADE_THRESHOLD_MS = 33;
const ADAPTIVE_SUSTAINED_FRAMES = 30;
const ADAPTIVE_COOLDOWN_MS = 10000;
const OFFLINE_PRACTICE_HP_MULTIPLIER = 20;

function safeGetLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn(`Failed to read localStorage key ${key}`, e);
    return null;
  }
}

function safeSetLocalStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`Failed to write localStorage key ${key}`, e);
  }
}

type QualityTier = "low" | "medium" | "high";

interface QualityConfig {
  tier: QualityTier;
  enablePostFX: boolean;
  maxVfxCount: number;
  vfxCooldownMs: number;
  vfxIntensity: number;
  decorativeDensity: number;
  minimapRedrawIntervalMs: number;
}

interface VfxEffect {
  x: number;
  y: number;
  type: "impact" | "explosion";
  createdAt: number;
  ttlMs: number;
  radius: number;
}

export class Game extends Phaser.Scene {
  private graphics?: Phaser.GameObjects.Graphics;
  private inputManager = new InputManager();
  private zone = new ZoneManager(MAP_SIZE);
  private hud?: HUD;
  private ammoBar = new AmmoBar(AMMO_MAX);
  private miniMap = new MiniMap();
  private sfx = new Sfx();

  private quality!: QualityConfig;
  private staticLayer?: Phaser.GameObjects.RenderTexture;

  private players = new Map<string, Player>();
  private bullets: Bullet[] = [];
  private crates: Crate[] = [];
  private cubes: PowerCube[] = [];
  private walls: Phaser.Geom.Rectangle[] = [];
  private waters: Phaser.Geom.Rectangle[] = [];
  private grasses: Phaser.Geom.Rectangle[] = [];
  private botAttackCooldownMs = new Map<string, number>();
  private hostAuthority?: HostAuthority;
  private snapshotBuffer = new SnapshotBuffer();
  private peerManager?: PeerManager;
  private online = false;
  private hostPlayer = false;
  private remoteInputs = new Map<string, InputPacket>();
  private remoteAttackCooldownMs = new Map<string, number>();
  private snapshotBroadcastAccumMs = 0;

  private vfxEffects: VfxEffect[] = [];
  private lastImpactVfxTime = 0;

  private lastLocalHp = -1;
  private lastDamageFeedbackMs = 0;
  private localPlayerId = "local-player";
  private finished = false;
  private finishedTimerMs = 0;
  private resultTransitioned = false;
  private nextBulletId = 1;
  private nextCubeId = 1;
  private inputSeq = 0;
  private snapshotTickCounter = 0;
  private battleStatusText?: Phaser.GameObjects.Text;
  private battleMetaText?: Phaser.GameObjects.Text;
  private zoneProgressTrack?: Phaser.GameObjects.Rectangle;
  private zoneProgressFill?: Phaser.GameObjects.Rectangle;
  private dangerVignette?: Phaser.GameObjects.Rectangle;
  private qualityIndicatorText?: Phaser.GameObjects.Text;
  private lastMinimapDrawTime = -1000;
  private qualityToggleHandler?: () => void;
  private qualityPointerHandler?: (
    pointer: Phaser.Input.Pointer,
    localX: number,
    localY: number,
    event: Phaser.Types.Input.EventData
  ) => void;
  private lastQualitySwitchMs = -1000;
  private slowFrameCount = 0;
  private lastAdaptiveDowngradeMs = 0;
  private isQualityAuto = true;
  private isNetworkActive = false;
  private lastAppliedSnapshotTick = -1;
  private signalingHandler?: (message: HostToClientMessage) => void;
  private minimapPlayersScratch: Array<{ x: number; y: number; teamId: string; isSelf: boolean }> = [];
  private minimapZoneScratch = { centerX: 0, centerY: 0, radius: 0 };
  private minimapDrawParams = {
    players: this.minimapPlayersScratch,
    zone: this.minimapZoneScratch,
    selfTeam: undefined as string | undefined,
    isOutsideZone: false,
    signature: 0,
  };
  private snapshotSeenPlayerIds = new Set<string>();
  private snapshotBulletsById = new Map<string, Bullet>();

  constructor() {
    super("Game");
  }

  private resetSceneState(): void {
    this.inputManager.unbind(this);
    this.zone = new ZoneManager(MAP_SIZE);
    this.inputManager = new InputManager();

    this.players.clear();
    this.bullets = [];
    this.crates = [];
    this.cubes = [];
    this.walls = [];
    this.waters = [];
    this.grasses = [];

    this.botAttackCooldownMs.clear();
    this.remoteInputs.clear();
    this.remoteAttackCooldownMs.clear();
    this.snapshotBroadcastAccumMs = 0;

    this.vfxEffects = [];
    this.lastImpactVfxTime = 0;
    this.lastLocalHp = -1;
    this.lastDamageFeedbackMs = 0;

    this.localPlayerId = "local-player";
    this.finished = false;
    this.finishedTimerMs = 0;
    this.resultTransitioned = false;
    this.nextBulletId = 1;
    this.nextCubeId = 1;
    this.inputSeq = 0;
    this.snapshotTickCounter = 0;

    this.hostAuthority = undefined;
    this.snapshotBuffer = new SnapshotBuffer();
    this.peerManager?.close();
    this.peerManager = undefined;
    this.online = false;
    this.hostPlayer = false;

    this.staticLayer?.destroy();
    this.staticLayer = undefined;
    this.graphics = undefined;
    this.hud = undefined;
    this.battleStatusText = undefined;
    this.battleMetaText = undefined;
    this.zoneProgressTrack = undefined;
    this.zoneProgressFill = undefined;
    this.dangerVignette = undefined;
    this.qualityIndicatorText = undefined;
    this.qualityToggleHandler = undefined;
    this.qualityPointerHandler = undefined;
    this.lastMinimapDrawTime = -1000;
    this.lastQualitySwitchMs = -1000;
    this.slowFrameCount = 0;
    this.lastAdaptiveDowngradeMs = 0;
    this.isQualityAuto = true;
    this.lastBattleStatusText = "";
    this.lastBattleMetaText = "";
    this.lastBattleStatusColor = "";
    this.lastBattleMetaColor = "";
    this.lastZoneProgress = -1;
    this.lastZoneColor = -1;
    this.lastDangerAlpha = -1;
    this.lastHudZoneMode = -1;
    this.lastHudZoneStage = -1;
    this.lastHudZoneCountdownSec = -1;
    this.hudStatusTextCache = "";
    this.lastHudHpRound = -1;
    this.lastHudMaxHpRound = -1;
    this.lastHudCubes = -1;
    this.lastHudSuperRound = -1;
    this.isNetworkActive = false;
    this.lastAppliedSnapshotTick = -1;
    this.signalingHandler = undefined;
    this.snapshotSeenPlayerIds.clear();
    this.snapshotBulletsById.clear();
    this.minimapZoneScratch.centerX = 0;
    this.minimapZoneScratch.centerY = 0;
    this.minimapZoneScratch.radius = 0;
  }

  private resolveInitialTier(): QualityTier {
    const urlParams = new URLSearchParams(window.location.search);
    const qualityParam = urlParams.get("quality");
    if (qualityParam === "low" || qualityParam === "medium" || qualityParam === "high") {
      this.isQualityAuto = false;
      return qualityParam;
    }

    const stored = safeGetLocalStorage(QUALITY_STORAGE_KEY);
    if (stored === "low" || stored === "medium" || stored === "high") {
      this.isQualityAuto = false;
      return stored;
    }

    this.isQualityAuto = true;
    const cores = navigator.hardwareConcurrency || 4;
    if (cores <= 4) return "low";
    if (cores <= 8) return "medium";
    return "high";
  }

  private applyQualityTier(tier: QualityTier): void {
    this.quality = {
      tier,
      enablePostFX: tier === "high",
      maxVfxCount: tier === "low" ? 10 : tier === "medium" ? 20 : 30,
      vfxCooldownMs: tier === "low" ? 32 : tier === "medium" ? 24 : 16,
      vfxIntensity: tier === "low" ? 0.5 : tier === "medium" ? 0.8 : 1.0,
      decorativeDensity: tier === "low" ? 0 : tier === "medium" ? 0.5 : 1.0,
      minimapRedrawIntervalMs: tier === "low" ? 100 : tier === "medium" ? 50 : 33,
    };
  }

  private cycleQuality(): void {
    if (this.time.now - this.lastQualitySwitchMs < 220) {
      return;
    }
    this.lastQualitySwitchMs = this.time.now;

    const nextTier: Record<QualityTier, QualityTier> = {
      low: "medium",
      medium: "high",
      high: "low",
    };
    const newTier = nextTier[this.quality.tier];
    
    this.isQualityAuto = false;
    safeSetLocalStorage(QUALITY_STORAGE_KEY, newTier);

    this.applyQualityTier(newTier);
    if (this.vfxEffects.length > this.quality.maxVfxCount) {
      this.vfxEffects = this.vfxEffects.slice(-this.quality.maxVfxCount);
    }
    this.lastMinimapDrawTime = -1000;

    if (this.renderer.type === Phaser.WEBGL) {
      try {
        if (this.cameras.main.postFX) {
          this.cameras.main.postFX.clear();
          if (this.quality.enablePostFX) {
            this.cameras.main.postFX.addVignette(0.5, 0.5, 0.9, 0.3);
            this.cameras.main.postFX.addColorMatrix().saturate(1.2);
          }
        }
      } catch (e) {
        console.warn("Failed to update postFX", e);
      }
    }

    this.buildStaticLayer();
    this.updateQualityIndicator();
  }

  private updateQualityIndicator(): void {
    if (this.qualityIndicatorText) {
      const mode = this.isQualityAuto ? "AUTO" : "MANUAL";
      this.qualityIndicatorText.setText(`画质: ${this.quality.tier.toUpperCase()} [${mode}] (F3/点击)`);
    }
  }

  create() {
    this.resetSceneState();
    this.applyQualityTier(this.resolveInitialTier());

    const session = getSession();
    this.online = session.roomCode !== "LOCAL";
    this.hostPlayer = !this.online || session.playerId === session.hostId;

    this.cameras.main.setBackgroundColor("#1a2235");
    if (this.renderer.type === Phaser.WEBGL && this.quality.enablePostFX) {
      try {
        if (this.cameras.main.postFX) {
          this.cameras.main.postFX.addVignette(0.5, 0.5, 0.9, 0.3);
          this.cameras.main.postFX.addColorMatrix().saturate(1.2);
        }
      } catch (e) {
        console.warn("Failed to initialize postFX", e);
      }
    }
    this.graphics = this.add.graphics();
    this.inputManager.bind(this);
    this.hud = new HUD(this);
    this.ammoBar.attach(this);
    this.miniMap.attach(this);

    try {
      this.sfx.init();
    } catch (e) {
      console.warn("Failed to initialize SFX", e);
    }

    this.bootstrapMap();
    this.buildStaticLayer();
    this.bootstrapPlayers();
    this.bootstrapHostAuthority();
    if (this.online) {
      this.setupNetwork();
    }

    this.events.once("shutdown", () => {
      this.isNetworkActive = false;
      this.peerManager?.close();
      this.peerManager = undefined;
      this.inputManager.unbind(this);
      if (this.qualityToggleHandler) {
        this.input.keyboard?.off("keydown-F3", this.qualityToggleHandler);
      }
      if (this.qualityPointerHandler) {
        this.qualityIndicatorText?.off("pointerdown", this.qualityPointerHandler);
      }
      this.staticLayer?.destroy();
      this.staticLayer = undefined;

      const signaling = getSignalingClient();
      if (signaling.onMessage === this.signalingHandler) {
        signaling.onMessage = () => {};
      }
      this.signalingHandler = undefined;
    });

    const titlePanel = createPixelPanel(this, {
      x: 640,
      y: 24,
      width: 360,
      height: 44,
      depth: 20,
      scrollFactor: 0,
      fillColor: 0x132850,
      strokeColor: 0x73d7ff,
      glowColor: 0x9afee7,
      alpha: 0.92,
    });
    const titleText = this.add
      .text(0, 0, "荒野决斗进行中", getTextStyle("meta", { color: "#f6f3e8", fontSize: "18px" }))
      .setOrigin(0.5);
    titlePanel.container.add(titleText);

    const battlePanel = createPixelPanel(this, {
      x: 640,
      y: 68,
      width: 560,
      height: 52,
      depth: 20,
      scrollFactor: 0,
      fillColor: 0x13254a,
      strokeColor: 0x6ecfff,
      glowColor: 0x88ffe8,
      alpha: 0.9,
    });
    this.battleStatusText = this.add
      .text(0, -9, "排名预测 #10   击杀 0   存活 10/10", getTextStyle("meta", { color: "#f6f3e8", fontSize: "15px" }))
      .setOrigin(0.5);
    this.battleMetaText = this.add
      .text(0, 10, "房间 LOCAL   网络 离线   超级 0%", getTextStyle("meta", { color: "#9dd9ff", fontSize: "14px" }))
      .setOrigin(0.5);

    this.zoneProgressTrack = this.add
      .rectangle(0, 24, 430, 8, 0x0b1734, 0.86)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x4f6ea3, 0.9);
    this.zoneProgressFill = this.add
      .rectangle(-215, 24, 426, 6, 0x7bc8ff, 1)
      .setOrigin(0, 0.5)
      .setScale(0, 1);

    battlePanel.container.add([this.battleStatusText, this.battleMetaText, this.zoneProgressTrack, this.zoneProgressFill]);

    this.dangerVignette = this.add
      .rectangle(MAP_SIZE / 2, MAP_SIZE / 2, MAP_SIZE, MAP_SIZE, 0xff2f56, 0)
      .setScrollFactor(0)
      .setDepth(15);

    this.qualityIndicatorText = this.add
      .text(16, 16, "", getTextStyle("meta", { color: "#ffffff", fontSize: "14px" }))
      .setScrollFactor(0)
      .setDepth(30);
    this.updateQualityIndicator();

    this.qualityToggleHandler = () => {
      this.cycleQuality();
    };
    this.input.keyboard?.on("keydown-F3", this.qualityToggleHandler);

    this.qualityPointerHandler = (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData
    ) => {
      event.stopPropagation();
      this.cycleQuality();
    };

    this.qualityIndicatorText.setInteractive({ useHandCursor: true });
    this.qualityIndicatorText.on("pointerdown", this.qualityPointerHandler);
  }

  update(_time: number, delta: number) {
    if (this.finished) {
      this.finishedTimerMs += delta;
      if (!this.resultTransitioned && this.finishedTimerMs >= 1300) {
        this.resultTransitioned = true;
        this.scene.start("Result");
      }
      return;
    }

    this.checkAdaptiveDowngrade(delta);

    this.zone.update(delta);
    this.updatePlayers(delta);
    this.updateBots(delta);
    this.updateBullets(delta);
    this.collectPowerCubes();
    this.applyZoneDamage(delta);
    this.updateAuthority(delta);

    this.updateVfx();
    this.checkDamageFeedback();
    const { aliveCount, soleAliveId } = this.computeAliveState();
    this.renderWorld();
    this.updateHud(aliveCount);
    this.checkResult(aliveCount, soleAliveId);
  }

  private checkAdaptiveDowngrade(delta: number): void {
    if (this.quality.tier === "low") {
      return;
    }

    if (this.time.now - this.lastAdaptiveDowngradeMs < ADAPTIVE_COOLDOWN_MS) {
      this.slowFrameCount = 0;
      return;
    }

    if (delta > ADAPTIVE_DOWNGRADE_THRESHOLD_MS) {
      this.slowFrameCount++;
    } else {
      this.slowFrameCount = Math.max(0, this.slowFrameCount - 1);
    }

    if (this.slowFrameCount >= ADAPTIVE_SUSTAINED_FRAMES) {
      this.slowFrameCount = 0;
      this.lastAdaptiveDowngradeMs = this.time.now;
      
      const nextTier: Record<QualityTier, QualityTier> = {
        high: "medium",
        medium: "low",
        low: "low",
      };
      const newTier = nextTier[this.quality.tier];
      
      this.isQualityAuto = true;
      this.applyQualityTier(newTier);
      
      if (this.vfxEffects.length > this.quality.maxVfxCount) {
        this.vfxEffects = this.vfxEffects.slice(-this.quality.maxVfxCount);
      }
      this.lastMinimapDrawTime = -1000;
      
      if (this.renderer.type === Phaser.WEBGL) {
        try {
          if (this.cameras.main.postFX) {
            this.cameras.main.postFX.clear();
            if (this.quality.enablePostFX) {
              this.cameras.main.postFX.addVignette(0.5, 0.5, 0.9, 0.3);
              this.cameras.main.postFX.addColorMatrix().saturate(1.2);
            }
          }
        } catch (e) {
          console.warn("Failed to update postFX during adaptive downgrade", e);
        }
      }
      
      this.buildStaticLayer();
      this.updateQualityIndicator();
    }
  }

  private bootstrapMap(): void {
    const session = getSession();
    if (session.mapId === "map-2") {
      this.walls = [
        new Phaser.Geom.Rectangle(420, 380, 440, 36),
        new Phaser.Geom.Rectangle(420, 860, 440, 36),
        new Phaser.Geom.Rectangle(380, 420, 36, 440),
        new Phaser.Geom.Rectangle(860, 420, 36, 440),
      ];
      this.waters = [
        new Phaser.Geom.Rectangle(560, 560, 160, 160),
      ];
      this.grasses = [
        new Phaser.Geom.Rectangle(160, 160, 220, 180),
        new Phaser.Geom.Rectangle(900, 180, 220, 180),
        new Phaser.Geom.Rectangle(180, 900, 220, 180),
        new Phaser.Geom.Rectangle(900, 900, 220, 180),
      ];
    } else {
      this.walls = [
        new Phaser.Geom.Rectangle(610, 180, 60, 300),
        new Phaser.Geom.Rectangle(610, 800, 60, 300),
        new Phaser.Geom.Rectangle(180, 610, 300, 60),
        new Phaser.Geom.Rectangle(800, 610, 300, 60),
      ];
      this.waters = [
        new Phaser.Geom.Rectangle(240, 240, 120, 120),
        new Phaser.Geom.Rectangle(920, 240, 120, 120),
        new Phaser.Geom.Rectangle(240, 920, 120, 120),
        new Phaser.Geom.Rectangle(920, 920, 120, 120),
      ];
      this.grasses = [
        new Phaser.Geom.Rectangle(430, 260, 140, 120),
        new Phaser.Geom.Rectangle(760, 260, 140, 120),
        new Phaser.Geom.Rectangle(430, 900, 140, 120),
        new Phaser.Geom.Rectangle(760, 900, 140, 120),
      ];
    }

    const cratePoints: Array<[number, number]> = [
      [250, 510],
      [350, 700],
      [520, 510],
      [760, 510],
      [920, 700],
      [1030, 510],
      [250, 780],
      [1030, 780],
      [640, 360],
      [640, 940],
      [420, 640],
      [860, 640],
    ];

    this.crates = cratePoints.map((point, index) => new Crate(`crate-${index + 1}`, point[0], point[1], 1));
  }

  private buildStaticLayer(): void {
    if (!this.staticLayer) {
      this.staticLayer = this.add.renderTexture(0, 0, MAP_SIZE, MAP_SIZE);
      this.staticLayer.setOrigin(0, 0).setDepth(-1);
    } else {
      this.staticLayer.clear();
    }
    
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    
    g.fillStyle(0x22422f, 1);
    g.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    if (this.quality.decorativeDensity > 0) {
      g.lineStyle(2, 0x2a523a, 0.3 * this.quality.decorativeDensity);
      const step = this.quality.tier === "medium" ? 128 : 64;
      for (let i = 0; i <= MAP_SIZE; i += step) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i, MAP_SIZE);
        g.strokePath();
        g.beginPath();
        g.moveTo(0, i);
        g.lineTo(MAP_SIZE, i);
        g.strokePath();
      }
    }

    for (const grass of this.grasses) {
      g.fillStyle(0x183022, 0.4);
      g.fillRect(grass.x + 4, grass.y + 4, grass.width, grass.height);
      g.fillStyle(0x325f34, 0.95);
      g.fillRect(grass.x, grass.y, grass.width, grass.height);
      g.fillStyle(0x428244, 0.6);
      g.fillRect(grass.x + 4, grass.y + 4, grass.width - 8, grass.height - 8);
      
      if (this.quality.decorativeDensity > 0) {
        g.lineStyle(2, 0x2a523a, 0.5 * this.quality.decorativeDensity);
        g.beginPath();
        g.moveTo(grass.x + 10, grass.y + 10);
        g.lineTo(grass.x + 20, grass.y + 20);
        g.strokePath();
      }
    }

    for (const wall of this.walls) {
      g.fillStyle(0x151a22, 0.5);
      g.fillRect(wall.x + 6, wall.y + 6, wall.width, wall.height);
      g.fillStyle(0x7a8fa8, 1);
      g.fillRect(wall.x, wall.y, wall.width, wall.height);
      g.fillStyle(0x9cb2cc, 1);
      g.fillRect(wall.x, wall.y, wall.width, 8);
      g.lineStyle(2, 0x5a6d85, 1);
      g.strokeRect(wall.x, wall.y, wall.width, wall.height);
    }

    for (const water of this.waters) {
      g.fillStyle(0x1e4b9c, 0.95);
      g.fillRect(water.x, water.y, water.width, water.height);
      g.lineStyle(3, 0x4a8cff, 0.6);
      g.strokeRect(water.x, water.y, water.width, water.height);
      
      if (this.quality.decorativeDensity > 0) {
        g.fillStyle(0x6bb2ff, 0.2 * this.quality.decorativeDensity);
        g.fillRect(water.x + 8, water.y + 8, water.width - 16, 12);
        g.fillRect(water.x + 16, water.y + 28, water.width - 32, 8);
      }
    }
    
    this.staticLayer.draw(g);
    g.destroy();
  }

  private bootstrapPlayers(): void {
    const session = getSession();
    this.localPlayerId = session.playerId || "local-player";
    const mode = session.mode;

    const total = MAX_PLAYERS;
    const centerX = MAP_SIZE / 2;
    const centerY = MAP_SIZE / 2;
    const radius = 460;
    const allCharacters = getAllCharacters();

    let nextIndex = 0;

    if (this.online && session.lobbyPlayers.length > 0) {
      for (const lobbyPlayer of session.lobbyPlayers) {
        const angle = (Math.PI * 2 * nextIndex) / total;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        const character = getCharacterById(lobbyPlayer.characterId);

        const player = new Player({
          id: lobbyPlayer.id,
          name: lobbyPlayer.name,
          x,
          y,
          characterId: character.id as "gunner" | "bomber" | "brawler",
          baseHp: character.hp,
          speed: character.speed,
          teamId: lobbyPlayer.teamId,
          isBot: false,
        });
        this.players.set(player.id, player);
        if (player.id !== this.localPlayerId) {
          this.remoteAttackCooldownMs.set(player.id, 200);
        }
        nextIndex += 1;
      }
    }

    if (!this.players.has(this.localPlayerId)) {
      const localCharacter = getCharacterById(session.localPlayer.characterId);
      const localBaseHp = this.online ? localCharacter.hp : localCharacter.hp * OFFLINE_PRACTICE_HP_MULTIPLIER;
      const local = new Player({
        id: this.localPlayerId,
        name: session.localPlayer.name,
        x: centerX + radius,
        y: centerY,
        characterId: localCharacter.id as "gunner" | "bomber" | "brawler",
        baseHp: localBaseHp,
        speed: localCharacter.speed,
        teamId: mode === "duo" ? "T1" : "T1",
        isBot: false,
      });
      this.players.set(local.id, local);
      nextIndex += 1;
    }

    for (let i = nextIndex; i < total; i++) {
      const angle = (Math.PI * 2 * i) / total;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      const character = allCharacters[i % allCharacters.length];
      const teamIndex = mode === "duo" ? Math.floor(i / 2) + 1 : i + 1;

      const bot = new Player({
        id: `bot-${i}`,
        name: `BOT-${i}`,
        x,
        y,
        characterId: character.id as "gunner" | "bomber" | "brawler",
        baseHp: character.hp,
        speed: character.speed,
        teamId: `T${teamIndex}`,
        isBot: true,
      });
      this.players.set(bot.id, bot);
      this.botAttackCooldownMs.set(bot.id, 300 + Math.random() * 700);
    }
  }

  private updatePlayers(delta: number): void {
    for (const player of this.players.values()) {
      player.update(delta);
    }

    const me = this.players.get(this.localPlayerId);
    if (!me || !me.alive) {
      return;
    }

    const dx = this.inputManager.getDx();
    const dy = this.inputManager.getDy();
    this.movePlayer(me, dx, dy, delta);

    const aim = this.inputManager.getAim();
    const localInput: InputPacket = {
      seq: ++this.inputSeq,
      dx,
      dy,
      attack: false,
      skill: false,
      aimX: aim.aimX,
      aimY: aim.aimY,
    };

    if (this.inputManager.consumeAttackPressed()) {
      this.performAttack(me, aim.aimX, aim.aimY);
      localInput.attack = true;
    }
    if (this.inputManager.consumeSuperPressed()) {
      this.performSuper(me, aim.aimX, aim.aimY);
      localInput.skill = true;
    }

    this.hostAuthority?.enqueueInput(me.id, localInput);

    if (this.online && !this.hostPlayer && this.peerManager) {
      const session = getSession();
      this.peerManager.send(session.hostId, encodeInputPacket(localInput));
    }

    if (this.online && this.hostPlayer) {
      for (const [playerId, input] of this.remoteInputs.entries()) {
        const remote = this.players.get(playerId);
        if (!remote || !remote.alive) {
          continue;
        }

        this.movePlayer(remote, input.dx, input.dy, delta);
        const cooldown = Math.max(0, (this.remoteAttackCooldownMs.get(playerId) ?? 0) - delta);
        this.remoteAttackCooldownMs.set(playerId, cooldown);

        if (input.attack && cooldown <= 0) {
          this.performAttack(remote, input.aimX, input.aimY);
          this.remoteAttackCooldownMs.set(playerId, 180);
        }
        if (input.skill) {
          this.performSuper(remote, input.aimX, input.aimY);
        }
      }
    }
  }

  private updateBots(delta: number): void {
    if (this.online && !this.hostPlayer) {
      return;
    }

    for (const bot of this.players.values()) {
      if (!bot.isBot || !bot.alive) {
        continue;
      }

      let target: Player | null = null;
      let minDistSq = Infinity;
      for (const item of this.players.values()) {
        if (item.alive && item.teamId !== bot.teamId) {
          const dx = item.x - bot.x;
          const dy = item.y - bot.y;
          const dSq = dx * dx + dy * dy;
          if (dSq < minDistSq) {
            minDistSq = dSq;
            target = item;
          }
        }
      }
      const character = getCharacterById(bot.characterId);

      const behavior = computeBotInput({
        bot: { x: bot.x, y: bot.y },
        target: target ? { x: target.x, y: target.y } : null,
        attackRange: character.attackRange,
      });

      this.movePlayer(bot, behavior.dx, behavior.dy, delta);

      const cooldown = Math.max(0, (this.botAttackCooldownMs.get(bot.id) ?? 0) - delta);
      this.botAttackCooldownMs.set(bot.id, cooldown);

      if (behavior.shouldAttack && target && cooldown <= 0) {
        this.performAttack(bot, target.x, target.y);
        this.botAttackCooldownMs.set(bot.id, 600 + Math.random() * 600);
      }

      if (bot.superCharge >= 100 && target && Math.random() < 0.012) {
        this.performSuper(bot, target.x, target.y);
      }
    }
  }

  private movePlayer(player: Player, dx: number, dy: number, delta: number): void {
    if (!player.alive) {
      return;
    }

    const len = Math.sqrt(dx * dx + dy * dy);
    if (len <= 0) {
      return;
    }

    const nx = dx / len;
    const ny = dy / len;
    const dt = delta / 1000;
    const step = player.speed * dt;

    const nextX = Phaser.Math.Clamp(player.x + nx * step, 16, MAP_SIZE - 16);
    const nextY = Phaser.Math.Clamp(player.y + ny * step, 16, MAP_SIZE - 16);

    if (!this.isBlocked(nextX, nextY)) {
      player.x = nextX;
      player.y = nextY;
      return;
    }

    if (!this.isBlocked(nextX, player.y)) {
      player.x = nextX;
    } else if (!this.isBlocked(player.x, nextY)) {
      player.y = nextY;
    }
  }

  private isBlocked(x: number, y: number): boolean {
    for (const wall of this.walls) {
      if (wall.contains(x, y)) {
        return true;
      }
    }
    for (const water of this.waters) {
      if (water.contains(x, y)) {
        return true;
      }
    }
    return false;
  }

  private performAttack(attacker: Player, aimX: number, aimY: number): void {
    if (!attacker.consumeAmmo()) {
      return;
    }

    const character = getCharacterById(attacker.characterId);
    const damage = computeDamage(character.attackDamage, attacker.cubes);
    const direction = this.getDirection(attacker.x, attacker.y, aimX, aimY);

    if (character.attackPattern === "melee") {
      const rangeSq = character.attackRange * character.attackRange;
      let hitCount = 0;
      for (const target of this.players.values()) {
        if (!target.alive || target.teamId === attacker.teamId || target.id === attacker.id) {
          continue;
        }
        const distSq = this.distanceSq(attacker.x, attacker.y, target.x, target.y);
        if (distSq <= rangeSq) {
          this.applyDamage(attacker, target, damage);
          hitCount += 1;
        }
      }
      if (hitCount > 0) {
        attacker.addSuperCharge(hitCount * 20);
      }
      this.sfx.play(hitCount > 0 ? "hit" : "shoot");
      return;
    }

    if (character.attackPattern === "spread") {
      const angles = [-0.14, 0, 0.14];
      for (const angle of angles) {
        const rotated = this.rotate(direction.x, direction.y, angle);
        this.spawnBullet(attacker, {
          vx: rotated.x * 560,
          vy: rotated.y * 560,
          damage,
          radius: 7,
          ttlMs: 900,
          kind: "normal",
        });
      }
      this.sfx.play("shoot");
      return;
    }

    this.spawnBullet(attacker, {
      vx: direction.x * 300,
      vy: direction.y * 300,
      damage,
      radius: 16,
      ttlMs: 950,
      kind: "bomb",
    });
    this.sfx.play("shoot");
  }

  private performSuper(attacker: Player, aimX: number, aimY: number): void {
    if (!attacker.consumeSuper()) {
      return;
    }

    const character = getCharacterById(attacker.characterId);
    const direction = this.getDirection(attacker.x, attacker.y, aimX, aimY);
    const superDamage = computeDamage(character.superDamage, attacker.cubes);

    if (character.superPattern === "dash") {
      attacker.invulnerableMs = 450;
      attacker.x = Phaser.Math.Clamp(attacker.x + direction.x * 180, 16, MAP_SIZE - 16);
      attacker.y = Phaser.Math.Clamp(attacker.y + direction.y * 180, 16, MAP_SIZE - 16);
      for (const target of this.players.values()) {
        if (!target.alive || target.teamId === attacker.teamId || target.id === attacker.id) {
          continue;
        }
        if (this.distanceSq(attacker.x, attacker.y, target.x, target.y) <= 90 * 90) {
          this.applyDamage(attacker, target, 750);
        }
      }
      this.sfx.play("hit");
      return;
    }

    if (character.superPattern === "mega-bomb") {
      this.spawnBullet(attacker, {
        vx: direction.x * 250,
        vy: direction.y * 250,
        damage: superDamage,
        radius: 24,
        ttlMs: 1100,
        kind: "super",
      });
      this.sfx.play("shoot");
      return;
    }

    attacker.x = Phaser.Math.Clamp(attacker.x + direction.x * 220, 16, MAP_SIZE - 16);
    attacker.y = Phaser.Math.Clamp(attacker.y + direction.y * 220, 16, MAP_SIZE - 16);
    for (const target of this.players.values()) {
      if (!target.alive || target.teamId === attacker.teamId || target.id === attacker.id) {
        continue;
      }
      if (this.distanceSq(attacker.x, attacker.y, target.x, target.y) <= 120 * 120) {
        this.applyDamage(attacker, target, superDamage);
      }
    }
    this.sfx.play("hit");
  }

  private spawnBullet(
    attacker: Player,
    params: { vx: number; vy: number; damage: number; radius: number; ttlMs: number; kind: "normal" | "bomb" | "super" }
  ): void {
    this.bullets.push(
      new Bullet({
        id: `b-${this.nextBulletId++}`,
        ownerId: attacker.id,
        x: attacker.x,
        y: attacker.y,
        vx: params.vx,
        vy: params.vy,
        damage: params.damage,
        radius: params.radius,
        ttlMs: params.ttlMs,
        kind: params.kind,
      })
    );
  }

  private updateBullets(delta: number): void {
    let bulletWrite = 0;

    for (let i = 0; i < this.bullets.length; i++) {
      const bullet = this.bullets[i];
      bullet.update(delta);

      if (bullet.x < 0 || bullet.x > MAP_SIZE || bullet.y < 0 || bullet.y > MAP_SIZE) {
        continue;
      }

      let consumed = false;

      for (const crate of this.crates) {
        if (consumed) {
          break;
        }
        const hitCrate = this.distanceSq(crate.x, crate.y, bullet.x, bullet.y) <= (bullet.radius + 18) * (bullet.radius + 18);
        if (!hitCrate) {
          continue;
        }

        const broken = crate.takeDamage(bullet.damage);
        if (broken) {
          this.spawnPowerCube(crate.x, crate.y, crate.cubeCount);
        }
        consumed = true;
        if (bullet.kind !== "normal") {
          this.explodeBullet(bullet);
        }
      }

      if (!consumed) {
        const owner = this.players.get(bullet.ownerId);
        if (owner) {
          for (const target of this.players.values()) {
            if (!target.alive || target.id === bullet.ownerId || owner.teamId === target.teamId) {
              continue;
            }
            const hit = this.distanceSq(target.x, target.y, bullet.x, bullet.y) <= (bullet.radius + 14) * (bullet.radius + 14);
            if (!hit) {
              continue;
            }
            this.applyDamage(owner, target, bullet.damage);
            owner.addSuperCharge(20);
            consumed = true;
            if (bullet.kind !== "normal") {
              this.explodeBullet(bullet);
            }
            break;
          }
        }
      }

      if (!consumed && bullet.isExpired()) {
        if (bullet.kind !== "normal") {
          this.explodeBullet(bullet);
        }
        consumed = true;
      }

      if (!consumed) {
        this.bullets[bulletWrite++] = bullet;
      }
    }

    this.bullets.length = bulletWrite;
    let crateWrite = 0;
    for (let crateRead = 0; crateRead < this.crates.length; crateRead++) {
      const crate = this.crates[crateRead];
      if (crate.hp > 0) {
        this.crates[crateWrite++] = crate;
      }
    }
    this.crates.length = crateWrite;
  }

  private explodeBullet(bullet: Bullet): void {
    const owner = this.players.get(bullet.ownerId);
    if (!owner) {
      return;
    }

    const blastRadius = bullet.kind === "super" ? 120 : 88;
    this.spawnVfx(bullet.x, bullet.y, "explosion", 400, blastRadius);
    for (const target of this.players.values()) {
      if (!target.alive || target.id === owner.id || target.teamId === owner.teamId) {
        continue;
      }
      if (this.distanceSq(target.x, target.y, bullet.x, bullet.y) <= blastRadius * blastRadius) {
        this.applyDamage(owner, target, bullet.damage);
      }
    }
  }

  private spawnPowerCube(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      this.cubes.push(new PowerCube(`cube-${this.nextCubeId++}`, x + i * 5, y + i * 5, 1));
    }
  }

  private collectPowerCubes(): void {
    for (const cube of this.cubes) {
      if (cube.collected) {
        continue;
      }
      for (const player of this.players.values()) {
        if (!player.alive) {
          continue;
        }
        if (this.distanceSq(cube.x, cube.y, player.x, player.y) <= 26 * 26) {
          cube.collected = true;
          player.addPowerCube(cube.value);
          if (player.id === this.localPlayerId) {
            this.sfx.play("pickup");
          }
          break;
        }
      }
    }

    let cubeWrite = 0;
    for (let cubeRead = 0; cubeRead < this.cubes.length; cubeRead++) {
      const cube = this.cubes[cubeRead];
      if (!cube.collected) {
        this.cubes[cubeWrite++] = cube;
      }
    }
    this.cubes.length = cubeWrite;
  }

  private applyZoneDamage(delta: number): void {
    if (!this.zone.isStarted()) {
      return;
    }

    const damage = (this.zone.getDamagePerSecond() * delta) / 1000;
    for (const player of this.players.values()) {
      if (!player.alive) {
        continue;
      }
      if (this.zone.isOutside(player.x, player.y)) {
        const died = player.takeDamage(damage);
        if (died) {
          this.onPlayerDeath(player, null);
        }
      }
    }
  }

  private onPlayerDeath(victim: Player, killer: Player | null): void {
    if (victim.cubes > 0) {
      this.spawnPowerCube(victim.x, victim.y, victim.cubes);
      victim.cubes = 0;
    }
    if (killer) {
      killer.kills += 1;
    }
    this.sfx.play("death");
  }

  private applyDamage(attacker: Player, target: Player, damage: number): void {
    const died = target.takeDamage(damage);
    attacker.damageDone += damage;
    if (died) {
      this.onPlayerDeath(target, attacker);
    } else {
      this.sfx.play("hit");
    }
    this.spawnVfx(target.x, target.y, "impact", 300, 20);
  }

  private computeAliveState(): { aliveCount: number; soleAliveId: string | null } {
    let aliveCount = 0;
    let soleAliveId: string | null = null;
    for (const player of this.players.values()) {
      if (!player.alive) {
        continue;
      }
      aliveCount += 1;
      soleAliveId = player.id;
    }
    return { aliveCount, soleAliveId };
  }

  private checkResult(aliveCount: number, soleAliveId: string | null): void {
    const local = this.players.get(this.localPlayerId);
    if (!local) {
      return;
    }

    if (!local.alive) {
      const rank = computeRank(aliveCount + 1);
      this.finishMatch(rank, local);
      return;
    }

    if (aliveCount === 1 && soleAliveId === local.id) {
      this.finishMatch(1, local);
    }
  }

  private finishMatch(rank: number, local: Player): void {
    if (this.finished) {
      return;
    }
    updateSession({
      result: {
        rank,
        kills: local.kills,
        damageDone: Math.round(local.damageDone),
        cubes: local.cubes,
      },
    });
    this.finished = true;
  }

  private renderWorld(): void {
    if (!this.graphics) {
      return;
    }

    this.graphics.clear();
    const isLow = this.quality.tier === "low";
    const isHigh = this.quality.tier === "high";

    if (this.zone.isStarted()) {
      this.graphics.lineStyle(5, 0xff6161, 1);
      this.graphics.strokeCircle(this.zone.centerX, this.zone.centerY, this.zone.radius);
      if (!isLow) {
        this.graphics.lineStyle(1, 0xffb3b3, 0.55);
        this.graphics.strokeCircle(this.zone.centerX, this.zone.centerY, Math.max(0, this.zone.radius - 8));
      }
    }

    for (const vfx of this.vfxEffects) {
      const progress = Phaser.Math.Clamp((this.time.now - vfx.createdAt) / vfx.ttlMs, 0, 1);
      const alpha = 1 - progress;
      if (vfx.type === "impact") {
        this.graphics.lineStyle(2, 0xffffff, alpha * 0.8 * this.quality.vfxIntensity);
        this.graphics.strokeCircle(vfx.x, vfx.y, vfx.radius + progress * 15);
      } else if (vfx.type === "explosion") {
        this.graphics.fillStyle(0xffaa00, alpha * 0.2 * this.quality.vfxIntensity);
        this.graphics.fillCircle(vfx.x, vfx.y, vfx.radius * progress);
        if (!isLow) {
          this.graphics.lineStyle(3, 0xff5500, alpha * 0.5 * this.quality.vfxIntensity);
          this.graphics.strokeCircle(vfx.x, vfx.y, vfx.radius * progress);
        }
      }
    }

    for (const crate of this.crates) {
      if (!isLow) {
        this.graphics.fillStyle(0x151a22, 0.4);
        this.graphics.fillRect(crate.x - 12, crate.y - 12, 32, 32);
      }
      this.graphics.fillStyle(0x8f4618, 1);
      this.graphics.fillRect(crate.x - 16, crate.y - 16, 32, 32);
      if (!isLow) {
        this.graphics.fillStyle(0xad5a24, 1);
        this.graphics.fillRect(crate.x - 16, crate.y - 16, 32, 6);
      }
      this.graphics.lineStyle(2, 0x5c2b0d, 0.95);
      this.graphics.strokeRect(crate.x - 16, crate.y - 16, 32, 32);
      const hpRatio = Phaser.Math.Clamp(crate.hp / 2000, 0, 1);
      this.graphics.fillStyle(0x0e1f1c, 0.85);
      this.graphics.fillRect(crate.x - 16, crate.y - 26, 32, 5);
      this.graphics.fillStyle(0x35d07b, 1);
      this.graphics.fillRect(crate.x - 16, crate.y - 26, 32 * hpRatio, 5);
    }

    for (const cube of this.cubes) {
      if (!isLow) {
        this.graphics.fillStyle(0x9de23a, 0.3);
        this.graphics.fillCircle(cube.x, cube.y, 12);
      }
      this.graphics.fillStyle(0x9de23a, 1);
      this.graphics.fillRect(cube.x - 6, cube.y - 6, 12, 12);
      if (isHigh) {
        this.graphics.fillStyle(0xe2ff8a, 0.9);
        this.graphics.fillRect(cube.x - 2, cube.y - 2, 4, 4);
      }
      this.graphics.lineStyle(1, 0x5a8c1a, 1);
      this.graphics.strokeRect(cube.x - 6, cube.y - 6, 12, 12);
    }

    for (const bullet of this.bullets) {
      const color = bullet.kind === "normal" ? 0xf8fafc : bullet.kind === "bomb" ? 0xffb020 : 0xff7a33;
      if (!isLow) {
        const glowColor = bullet.kind === "normal" ? 0xa0c4ff : bullet.kind === "bomb" ? 0xff8800 : 0xff3300;
        this.graphics.fillStyle(glowColor, 0.4 * this.quality.vfxIntensity);
        this.graphics.fillCircle(bullet.x, bullet.y, bullet.radius + 4);
      }
      this.graphics.fillStyle(color, 1);
      this.graphics.fillCircle(bullet.x, bullet.y, bullet.radius);
      if (!isLow) {
        this.graphics.lineStyle(2, 0xffffff, 0.8);
        this.graphics.strokeCircle(bullet.x, bullet.y, Math.max(2, bullet.radius - 1));
      }
    }

    for (const player of this.players.values()) {
      if (!player.alive) {
        continue;
      }
      const isLocal = player.id === this.localPlayerId;
      const color =
        player.characterId === "gunner"
          ? 0x66b9ff
          : player.characterId === "bomber"
            ? 0xff8a3d
            : 0xffdc5a;

      if (!isLow) {
        this.graphics.fillStyle(0x151a22, 0.4);
        this.graphics.fillEllipse(player.x, player.y + 12, 24, 12);
      }

      if (isLocal) {
        if (!isLow) {
          this.graphics.fillStyle(0x4488ff, 0.2);
          this.graphics.fillCircle(player.x, player.y, 26);
        }
        this.graphics.lineStyle(3, 0xffffff, 0.9);
        this.graphics.strokeCircle(player.x, player.y, 22);
        if (isHigh) {
          this.graphics.lineStyle(2, UI_THEME.colors.buttonStroke, 1);
          this.graphics.strokeCircle(player.x, player.y, 26);
        }
      }

      this.graphics.fillStyle(color, 1);
      this.graphics.fillCircle(player.x, player.y, 14);
      if (!isLow) {
        this.graphics.fillStyle(0xffffff, 0.3);
        this.graphics.fillCircle(player.x - 4, player.y - 4, 6);
      }
      this.graphics.lineStyle(2, 0x0b1428, 0.85);
      this.graphics.strokeCircle(player.x, player.y, 14);

      const hpRatio = Phaser.Math.Clamp(player.hp / player.maxHp, 0, 1);
      const isLowHp = hpRatio <= 0.35;
      this.graphics.fillStyle(0x101421, 0.85);
      this.graphics.fillRect(player.x - 18, player.y - 28, 36, 6);
      const hpColor = isLowHp ? 0xff3333 : (isLocal ? 0x31d679 : 0xe84141);
      this.graphics.fillStyle(hpColor, 1);
      this.graphics.fillRect(player.x - 18, player.y - 28, 36 * hpRatio, 6);
      this.graphics.lineStyle(1, 0x000000, 0.8);
      this.graphics.strokeRect(player.x - 18, player.y - 28, 36, 6);

      if (player.cubes > 0) {
        this.graphics.fillStyle(0xffec8e, 1);
        this.graphics.fillRect(player.x - 18, player.y - 34, Math.min(36, player.cubes * 4), 4);
        this.graphics.lineStyle(1, 0x000000, 0.8);
        this.graphics.strokeRect(player.x - 18, player.y - 34, Math.min(36, player.cubes * 4), 4);
      }
    }
  }

  private updateHud(alive: number): void {
    const local = this.players.get(this.localPlayerId);
    if (!local || !this.hud) {
      return;
    }

    this.hud.updateAlive(alive, MAX_PLAYERS);

    if (!this.zone.isStarted()) {
      const countdownSec = Math.ceil(this.zone.getMsUntilStart() / 1000);
      if (
        this.lastHudZoneMode !== 0 ||
        this.lastHudZoneCountdownSec !== countdownSec
      ) {
        this.lastHudZoneMode = 0;
        this.lastHudZoneStage = -1;
        this.lastHudZoneCountdownSec = countdownSec;
        this.hud.updateZone(`毒圈开始倒计时: ${countdownSec}s`);
      }
    } else if (this.zone.stage < 5) {
      const countdownSec = Math.ceil(this.zone.getMsUntilNextShrink() / 1000);
      if (
        this.lastHudZoneMode !== 1 ||
        this.lastHudZoneStage !== this.zone.stage ||
        this.lastHudZoneCountdownSec !== countdownSec
      ) {
        this.lastHudZoneMode = 1;
        this.lastHudZoneStage = this.zone.stage;
        this.lastHudZoneCountdownSec = countdownSec;
        this.hud.updateZone(`毒圈阶段 ${this.zone.stage} / 5, 下一次收缩: ${countdownSec}s`);
      }
    } else if (this.lastHudZoneMode !== 2) {
      this.lastHudZoneMode = 2;
      this.lastHudZoneStage = 5;
      this.lastHudZoneCountdownSec = 0;
      this.hud.updateZone("毒圈已到最终阶段");
    }

    const isLowHp = local.hp / local.maxHp <= 0.35;
    const isOutsideZone = this.zone.isOutside(local.x, local.y);
    const isDanger = isLowHp || isOutsideZone;

    const hpRound = Math.round(local.hp);
    const maxHpRound = Math.round(local.maxHp);
    const superRound = Math.round(local.superCharge);
    if (
      this.lastHudHpRound !== hpRound ||
      this.lastHudMaxHpRound !== maxHpRound ||
      this.lastHudCubes !== local.cubes ||
      this.lastHudSuperRound !== superRound
    ) {
      this.lastHudHpRound = hpRound;
      this.lastHudMaxHpRound = maxHpRound;
      this.lastHudCubes = local.cubes;
      this.lastHudSuperRound = superRound;
      this.hudStatusTextCache = `HP ${hpRound}/${maxHpRound}  能量 ${local.cubes}  超级 ${superRound}%`;
    }

    this.hud.updateStatus(this.hudStatusTextCache, isDanger);
    this.ammoBar.update(local.ammo, isDanger);
    this.updateBattlePanel(local, alive);

    if (this.time.now - this.lastMinimapDrawTime >= this.quality.minimapRedrawIntervalMs) {
      this.lastMinimapDrawTime = this.time.now;
      let signature = 0;
      signature = (signature * 31 + Math.round(this.zone.centerX)) | 0;
      signature = (signature * 31 + Math.round(this.zone.centerY)) | 0;
      signature = (signature * 31 + Math.round(this.zone.radius)) | 0;
      const minimapOutsideZone = local.alive ? isOutsideZone : false;
      let scratchIdx = 0;
      for (const player of this.players.values()) {
        if (!player.alive) continue;
        let item = this.minimapPlayersScratch[scratchIdx];
        if (!item) {
          item = { x: 0, y: 0, teamId: "", isSelf: false };
          this.minimapPlayersScratch[scratchIdx] = item;
        }
        item.x = player.x;
        item.y = player.y;
        item.teamId = player.teamId;
        item.isSelf = player.id === this.localPlayerId;
        scratchIdx++;
        
        signature = (signature * 31 + Math.round(player.x)) | 0;
        signature = (signature * 31 + Math.round(player.y)) | 0;
      }
      signature = (signature * 31 + (minimapOutsideZone ? 1 : 0)) | 0;
      signature = (signature * 31 + scratchIdx) | 0;
      this.minimapPlayersScratch.length = scratchIdx;
      this.minimapZoneScratch.centerX = this.zone.centerX;
      this.minimapZoneScratch.centerY = this.zone.centerY;
      this.minimapZoneScratch.radius = this.zone.radius;
      this.minimapDrawParams.selfTeam = local.alive ? local.teamId : undefined;
      this.minimapDrawParams.isOutsideZone = minimapOutsideZone;
      this.minimapDrawParams.signature = signature;
      this.miniMap.draw(this.minimapDrawParams);
    }
  }
  private lastBattleStatusText = "";
  private lastBattleMetaText = "";
  private lastBattleStatusColor = "";
  private lastBattleMetaColor = "";
  private lastZoneProgress = -1;
  private lastZoneColor = -1;
  private lastDangerAlpha = -1;
  private lastHudZoneMode = -1;
  private lastHudZoneStage = -1;
  private lastHudZoneCountdownSec = -1;
  private hudStatusTextCache = "";
  private lastHudHpRound = -1;
  private lastHudMaxHpRound = -1;
  private lastHudCubes = -1;
  private lastHudSuperRound = -1;


  private updateBattlePanel(local: Player, aliveCount: number): void {
    if (!this.battleStatusText || !this.battleMetaText || !this.zoneProgressFill) {
      return;
    }

    const projectedRank = local.alive ? computeRank(aliveCount) : computeRank(aliveCount + 1);
    const networkLabel = this.online ? (this.hostPlayer ? "在线 Host" : "在线 Client") : "离线";
    const roomLabel = getSession().roomCode || "LOCAL";

    let zoneProgress = 0;
    let zoneColor = 0x7bc8ff;
    if (!this.zone.isStarted()) {
      zoneProgress = 1 - this.zone.getMsUntilStart() / ZONE_START_DELAY_MS;
      zoneColor = 0x7bc8ff;
    } else if (this.zone.stage < 5) {
      zoneProgress = 1 - this.zone.getMsUntilNextShrink() / ZONE_SHRINK_INTERVAL_MS;
      zoneColor = this.zone.stage >= 4 ? 0xffb37a : 0x7cf2b5;
    } else {
      zoneProgress = 1;
      zoneColor = 0xff7f8f;
    }
    zoneProgress = Phaser.Math.Clamp(zoneProgress, 0, 1);
    if (this.lastZoneProgress !== zoneProgress || this.lastZoneColor !== zoneColor) {
      this.lastZoneProgress = zoneProgress;
      this.lastZoneColor = zoneColor;
      this.zoneProgressFill.setScale(zoneProgress, 1).setFillStyle(zoneColor, 1);
    }

    const statusText = `排名预测 #${projectedRank}   击杀 ${local.kills}   存活 ${aliveCount}/${MAX_PLAYERS}`;
    if (this.lastBattleStatusText !== statusText) {
      this.lastBattleStatusText = statusText;
      this.battleStatusText.setText(statusText);
    }

    const metaText = `房间 ${roomLabel}   网络 ${networkLabel}   超级 ${Math.round(local.superCharge)}%`;
    if (this.lastBattleMetaText !== metaText) {
      this.lastBattleMetaText = metaText;
      this.battleMetaText.setText(metaText);
    }
    const lowHp = local.hp / local.maxHp <= 0.35;
    const statusColor = lowHp ? "#ffd2d9" : "#f6f3e8";
    if (this.lastBattleStatusColor !== statusColor) {
      this.lastBattleStatusColor = statusColor;
      this.battleStatusText.setColor(statusColor);
    }

    const metaColor = lowHp ? "#ffc0cc" : "#9dd9ff";
    if (this.lastBattleMetaColor !== metaColor) {
      this.lastBattleMetaColor = metaColor;
      this.battleMetaText.setColor(metaColor);
    }
    if (this.dangerVignette) {
      let pressure = 0;
      if (lowHp) {
        const ratio = local.hp / Math.max(1, local.maxHp);
        pressure += Phaser.Math.Clamp((0.35 - ratio) * 0.8, 0.08, 0.28);
      }
      if (this.zone.isOutside(local.x, local.y)) {
        pressure += 0.25;
      } else if (this.zone.stage >= 4) {
        pressure += 0.1;
      }

      let targetAlpha = 0;
      if (pressure > 0) {
        const pulse = 0.75 + 0.25 * Math.sin(this.time.now / 120);
        targetAlpha = Math.min(pressure * pulse, 0.7);
      }
      
      if (this.lastDangerAlpha !== targetAlpha) {
        this.lastDangerAlpha = targetAlpha;
        this.dangerVignette.setAlpha(targetAlpha);
      }
    }
  }

  private updateVfx(): void {
    const now = this.time.now;
    let vfxWrite = 0;
    for (let vfxRead = 0; vfxRead < this.vfxEffects.length; vfxRead++) {
      const vfx = this.vfxEffects[vfxRead];
      if (now - vfx.createdAt < vfx.ttlMs) {
        this.vfxEffects[vfxWrite++] = vfx;
      }
    }
    this.vfxEffects.length = vfxWrite;
  }

  private spawnVfx(x: number, y: number, type: "impact" | "explosion", ttlMs: number, radius: number): void {
    if (this.vfxEffects.length >= this.quality.maxVfxCount) {
      if (type === "impact") {
        return;
      }

      let removeIndex = -1;
      for (let i = 0; i < this.vfxEffects.length; i++) {
        if (this.vfxEffects[i].type === "impact") {
          removeIndex = i;
          break;
        }
      }

      if (removeIndex < 0) {
        removeIndex = 0;
      }

      for (let i = removeIndex + 1; i < this.vfxEffects.length; i++) {
        this.vfxEffects[i - 1] = this.vfxEffects[i];
      }
      this.vfxEffects.length -= 1;
    }

    if (type === "impact" && this.time.now - this.lastImpactVfxTime < this.quality.vfxCooldownMs) {
      return;
    }

    if (type === "impact") {
      this.lastImpactVfxTime = this.time.now;
    }

    this.vfxEffects.push({ x, y, type, createdAt: this.time.now, ttlMs, radius });
  }

  private checkDamageFeedback(): void {
    const local = this.players.get(this.localPlayerId);
    if (!local || !local.alive) {
      this.lastLocalHp = -1;
      return;
    }

    if (this.lastLocalHp < 0) {
      this.lastLocalHp = local.hp;
      return;
    }

    const damage = this.lastLocalHp - local.hp;
    this.lastLocalHp = local.hp;

    if (damage > 10 && this.time.now - this.lastDamageFeedbackMs > 400) {
      this.lastDamageFeedbackMs = this.time.now;
      if (this.cameras.main) {
        this.cameras.main.shake(120, 0.003);
        this.cameras.main.flash(100, 255, 50, 50);
      }
    }
  }

  private bootstrapHostAuthority(): void {
    this.hostAuthority = new HostAuthority({
      centerX: this.zone.centerX,
      centerY: this.zone.centerY,
      radius: this.zone.radius,
      stage: this.zone.stage,
      started: this.zone.isStarted(),
      msUntilStart: this.zone.getMsUntilStart(),
      msUntilNextShrink: this.zone.getMsUntilNextShrink(),
    });

    for (const player of this.players.values()) {
      this.hostAuthority.registerPlayer(player.id, {
        x: player.x,
        y: player.y,
        hp: player.hp,
        ammo: player.ammo,
        superCharge: player.superCharge,
        cubes: player.cubes,
        kills: player.kills,
        damageDone: player.damageDone,
        alive: player.alive,
        teamId: player.teamId,
        characterId: player.characterId,
        name: player.name,
      });
    }
  }

  private updateAuthority(delta: number): void {
    if (!this.hostAuthority) {
      return;
    }

    if (this.online && !this.hostPlayer) {
      const latest = this.snapshotBuffer.latest();
      if (latest && latest.tick > this.lastAppliedSnapshotTick) {
        this.applyNetworkSnapshot(latest);
      }
      return;
    }

    this.hostAuthority.setZone({
      centerX: this.zone.centerX,
      centerY: this.zone.centerY,
      radius: this.zone.radius,
      stage: this.zone.stage,
      started: this.zone.isStarted(),
      msUntilStart: this.zone.getMsUntilStart(),
      msUntilNextShrink: this.zone.getMsUntilNextShrink(),
    });

    const snapshots = this.hostAuthority.update(delta);
    for (const snapshot of snapshots) {
      this.snapshotBuffer.push(snapshot);
    }

    if (this.online && this.hostPlayer && this.peerManager) {
      this.snapshotBroadcastAccumMs += delta;
      const snapshotStep = 1000 / GAME_TICK_RATE;
      while (this.snapshotBroadcastAccumMs >= snapshotStep) {
        this.snapshotBroadcastAccumMs -= snapshotStep;
        this.peerManager.broadcast(encodeSnapshot(this.buildWorldSnapshot()));
      }
    }

    const latest = this.snapshotBuffer.latest();
    if (!latest) {
      return;
    }

    const me = this.players.get(this.localPlayerId);
    let authoritative: PlayerState | undefined;
    for (let i = 0; i < latest.players.length; i++) {
      const item = latest.players[i];
      if (item.id === this.localPlayerId) {
        authoritative = item;
        break;
      }
    }
    if (!me || !authoritative) {
      return;
    }

    const dx = authoritative.x - me.x;
    const dy = authoritative.y - me.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 36) {
      me.x = authoritative.x;
      me.y = authoritative.y;
    } else {
      me.x += dx * 0.35;
      me.y += dy * 0.35;
    }
  }

  private buildWorldSnapshot(): GameSnapshot {
    const players: PlayerState[] = [];
    let aliveCount = 0;
    for (const player of this.players.values()) {
      players.push({
        id: player.id,
        name: player.name,
        x: player.x,
        y: player.y,
        hp: player.hp,
        maxHp: player.maxHp,
        ammo: player.ammo,
        superCharge: player.superCharge,
        cubes: player.cubes,
        kills: player.kills,
        damageDone: Math.round(player.damageDone),
        alive: player.alive,
        characterId: player.characterId,
        teamId: player.teamId,
      });
      if (player.alive) {
        aliveCount++;
      }
    }

    const bullets: BulletState[] = [];
    for (let i = 0; i < this.bullets.length; i++) {
      const bullet = this.bullets[i];
      bullets.push({
        id: bullet.id,
        ownerId: bullet.ownerId,
        x: bullet.x,
        y: bullet.y,
        vx: bullet.vx,
        vy: bullet.vy,
        damage: bullet.damage,
        radius: bullet.radius,
        ttlMs: bullet.ttlMs,
        kind: bullet.kind,
      });
    }

    return {
      tick: ++this.snapshotTickCounter,
      elapsedMs: Math.round(this.time.now),
      players,
      bullets,
      zone: {
        centerX: this.zone.centerX,
        centerY: this.zone.centerY,
        radius: this.zone.radius,
        stage: this.zone.stage,
        started: this.zone.isStarted(),
        msUntilStart: this.zone.getMsUntilStart(),
        msUntilNextShrink: this.zone.getMsUntilNextShrink(),
      },
      aliveCount,
    };
  }

  private setupNetwork(): void {
    const session = getSession();
    const signaling = getSignalingClient();

    this.isNetworkActive = true;
    this.peerManager = new PeerManager();
    this.peerManager.onSignal = (peerId, type, payload) => {
      signaling.send({
        type,
        target: peerId,
        payload,
      });
    };

    this.peerManager.onPeerDisconnected = (peerId) => {
      this.remoteInputs.delete(peerId);
      this.remoteAttackCooldownMs.delete(peerId);
    };

    this.peerManager.onData = (peerId, data) => {
      if (!this.isNetworkActive) {
        return;
      }
      if (this.hostPlayer) {
        try {
          const input = decodeInputPacket(data);
          this.remoteInputs.set(peerId, input);
        } catch {
          void 0;
        }
        return;
      }

      try {
        const snapshot = decodeSnapshot(data);
        if (snapshot.tick <= this.lastAppliedSnapshotTick) {
          return;
        }
        this.snapshotBuffer.push(snapshot);
        this.applyNetworkSnapshot(snapshot);
      } catch {
        void 0;
      }
    };

    this.signalingHandler = (message) => {
      if (!this.isNetworkActive) {
        return;
      }
      if (message.type !== "signal") {
        return;
      }
      void this.handleSignalMessage(message.from, message.signalType, message.payload).catch((error: unknown) => {
        if (!this.isNetworkActive) {
          return;
        }
        console.warn("Failed to handle signal message", error);
      });
    };
    signaling.onMessage = this.signalingHandler;

    if (this.hostPlayer) {
      void this.createOffersForPeers(session.lobbyPlayers.map((player) => player.id));
    }
  }

  private async createOffersForPeers(peerIds: string[]): Promise<void> {
    const peerManager = this.peerManager;
    if (!peerManager || !this.isNetworkActive) {
      return;
    }

    const signaling = getSignalingClient();
    for (const peerId of peerIds) {
      if (peerId === this.localPlayerId) {
        continue;
      }
      try {
        const offer = await peerManager.createOffer(peerId);
        if (!this.isNetworkActive || this.peerManager !== peerManager) {
          return;
        }
        signaling.send({ type: "offer", target: peerId, payload: offer });
      } catch {
        void 0;
      }
    }
  }

  private async handleSignalMessage(
    from: string,
    signalType: "offer" | "answer" | "ice-candidate",
    payload: unknown
  ): Promise<void> {
    const peerManager = this.peerManager;
    if (!peerManager || !this.isNetworkActive) {
      return;
    }

    const signaling = getSignalingClient();
    if (signalType === "offer") {
      const answer = await peerManager.handleOffer(from, payload as RTCSessionDescriptionInit);
      if (!this.isNetworkActive || this.peerManager !== peerManager) {
        return;
      }
      signaling.send({
        type: "answer",
        target: from,
        payload: answer,
      });
      return;
    }

    if (signalType === "answer") {
      await peerManager.handleAnswer(from, payload as RTCSessionDescriptionInit);
      return;
    }

    await peerManager.handleIceCandidate(from, payload as RTCIceCandidateInit);
  }

  private applyNetworkSnapshot(snapshot: GameSnapshot): void {
    if (snapshot.tick <= this.lastAppliedSnapshotTick) {
      return;
    }
    this.lastAppliedSnapshotTick = snapshot.tick;

    this.zone.sync(snapshot.zone);

    this.snapshotSeenPlayerIds.clear();
    for (let i = 0; i < snapshot.players.length; i++) {
      const playerState = snapshot.players[i];
      this.snapshotSeenPlayerIds.add(playerState.id);
      let existing = this.players.get(playerState.id);
      if (!existing) {
        existing = new Player({
          id: playerState.id,
          name: playerState.name,
          x: playerState.x,
          y: playerState.y,
          characterId: playerState.characterId,
          baseHp: playerState.maxHp,
          speed: getCharacterById(playerState.characterId).speed,
          teamId: playerState.teamId,
          isBot: false,
        });
        this.players.set(playerState.id, existing);
      }

      existing.x = playerState.x;
      existing.y = playerState.y;
      existing.hp = playerState.hp;
      existing.maxHp = playerState.maxHp;
      existing.ammo = playerState.ammo;
      existing.superCharge = playerState.superCharge;
      existing.cubes = playerState.cubes;
      existing.kills = playerState.kills;
      existing.damageDone = playerState.damageDone;
      existing.alive = playerState.alive;
    }

    for (const id of this.players.keys()) {
      if (!this.snapshotSeenPlayerIds.has(id)) {
        this.players.delete(id);
      }
    }

    this.snapshotBulletsById.clear();
    for (let i = 0; i < this.bullets.length; i++) {
      const b = this.bullets[i];
      this.snapshotBulletsById.set(b.id, b);
    }

    let bulletWrite = 0;
    for (let i = 0; i < snapshot.bullets.length; i++) {
      const bState = snapshot.bullets[i];
      let b = this.snapshotBulletsById.get(bState.id);
      if (b) {
        b.ownerId = bState.ownerId;
        b.x = bState.x;
        b.y = bState.y;
        b.vx = bState.vx;
        b.vy = bState.vy;
        b.damage = bState.damage;
        b.radius = bState.radius;
        b.ttlMs = bState.ttlMs;
        b.kind = bState.kind;
      } else {
        b = new Bullet({
          id: bState.id,
          ownerId: bState.ownerId,
          x: bState.x,
          y: bState.y,
          vx: bState.vx,
          vy: bState.vy,
          damage: bState.damage,
          radius: bState.radius,
          ttlMs: bState.ttlMs,
          kind: bState.kind,
        });
      }
      this.bullets[bulletWrite++] = b;
    }
    this.bullets.length = bulletWrite;
  }

  private getDirection(fromX: number, fromY: number, toX: number, toY: number): { x: number; y: number } {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) {
      return { x: 1, y: 0 };
    }
    return { x: dx / length, y: dy / length };
  }

  private rotate(x: number, y: number, angle: number): { x: number; y: number } {
    return {
      x: x * Math.cos(angle) - y * Math.sin(angle),
      y: x * Math.sin(angle) + y * Math.cos(angle),
    };
  }

  private distanceSq(ax: number, ay: number, bx: number, by: number): number {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  }
}
