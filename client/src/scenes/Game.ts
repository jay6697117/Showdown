import Phaser from "phaser";
import { AMMO_MAX, GAME_TICK_RATE, MAP_SIZE, MAX_PLAYERS, ZONE_SHRINK_INTERVAL_MS, ZONE_START_DELAY_MS } from "shared";
import { decodeInputPacket, decodeSnapshot, encodeInputPacket, encodeSnapshot } from "shared";
import type { GameSnapshot, InputPacket } from "shared";
import { getAllCharacters, getCharacterById } from "../characters";
import { Bullet } from "../entities/Bullet";
import { Crate } from "../entities/Crate";
import { Player } from "../entities/Player";
import { PowerCube } from "../entities/PowerCube";
import { chooseBotTarget, computeBotInput } from "../systems/BotController";
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
import { SnapshotBuffer, reconcilePrediction } from "../network/ClientSync";
import { getSession, updateSession } from "../state/session";
import { getSignalingClient } from "../state/runtime";

export class Game extends Phaser.Scene {
  private graphics?: Phaser.GameObjects.Graphics;
  private inputManager = new InputManager();
  private zone = new ZoneManager(MAP_SIZE);
  private hud?: HUD;
  private ammoBar = new AmmoBar(AMMO_MAX);
  private miniMap = new MiniMap();
  private sfx = new Sfx();

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

  private localPlayerId = "local-player";
  private finished = false;
  private finishedTimerMs = 0;
  private nextBulletId = 1;
  private nextCubeId = 1;
  private inputSeq = 0;
  private battleStatusText?: Phaser.GameObjects.Text;
  private battleMetaText?: Phaser.GameObjects.Text;
  private zoneProgressTrack?: Phaser.GameObjects.Rectangle;
  private zoneProgressFill?: Phaser.GameObjects.Rectangle;
  private dangerVignette?: Phaser.GameObjects.Rectangle;

  constructor() {
    super("Game");
  }

  create() {
    const session = getSession();
    this.online = session.roomCode !== "LOCAL";
    this.hostPlayer = !this.online || session.playerId === session.hostId;

    this.cameras.main.setBackgroundColor("#0f1933");
    this.graphics = this.add.graphics();
    this.inputManager.bind(this);
    this.hud = new HUD(this);
    this.ammoBar.attach(this);
    this.miniMap.attach(this);

    try {
      this.sfx.init();
    } catch {
      void 0;
    }

    this.bootstrapMap();
    this.bootstrapPlayers();
    this.bootstrapHostAuthority();
    if (this.online) {
      this.setupNetwork();
    }

    this.events.once("shutdown", () => {
      this.peerManager?.close();
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
  }

  update(_time: number, delta: number) {
    if (this.finished) {
      this.finishedTimerMs += delta;
      if (this.finishedTimerMs >= 1300) {
        this.scene.start("Result");
      }
      return;
    }

    this.zone.update(delta);
    this.updatePlayers(delta);
    this.updateBots(delta);
    this.updateBullets(delta);
    this.collectPowerCubes();
    this.applyZoneDamage(delta);
    this.updateAuthority(delta);

    this.renderWorld();
    this.updateHud();
    this.checkResult();
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
      const local = new Player({
        id: this.localPlayerId,
        name: session.localPlayer.name,
        x: centerX + radius,
        y: centerY,
        characterId: localCharacter.id as "gunner" | "bomber" | "brawler",
        baseHp: localCharacter.hp,
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

      const candidates = [...this.players.values()]
        .filter((item) => item.alive && item.teamId !== bot.teamId)
        .map((item) => ({ id: item.id, x: item.x, y: item.y }));

      const targetId = chooseBotTarget({ x: bot.x, y: bot.y }, candidates);
      const target = targetId ? this.players.get(targetId) ?? null : null;
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
    const nextBullets: Bullet[] = [];

    for (const bullet of this.bullets) {
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
        for (const target of this.players.values()) {
          if (!target.alive || target.id === bullet.ownerId) {
            continue;
          }
          const owner = this.players.get(bullet.ownerId);
          if (!owner || owner.teamId === target.teamId) {
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

      if (!consumed && bullet.isExpired()) {
        if (bullet.kind !== "normal") {
          this.explodeBullet(bullet);
        }
        consumed = true;
      }

      if (!consumed) {
        nextBullets.push(bullet);
      }
    }

    this.bullets = nextBullets;
    this.crates = this.crates.filter((crate) => crate.hp > 0);
  }

  private explodeBullet(bullet: Bullet): void {
    const owner = this.players.get(bullet.ownerId);
    if (!owner) {
      return;
    }

    const blastRadius = bullet.kind === "super" ? 120 : 88;
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

    this.cubes = this.cubes.filter((cube) => !cube.collected);
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
  }

  private checkResult(): void {
    const alivePlayers = [...this.players.values()].filter((item) => item.alive);
    const local = this.players.get(this.localPlayerId);
    if (!local) {
      return;
    }

    if (!local.alive) {
      const rank = computeRank(alivePlayers.length + 1);
      this.finishMatch(rank, local);
      return;
    }

    if (alivePlayers.length === 1 && alivePlayers[0].id === local.id) {
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
    this.graphics.fillStyle(0x1e3b2a, 1);
    this.graphics.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    this.graphics.lineStyle(1, 0x355c4a, 0.2);
    for (let i = 0; i <= MAP_SIZE; i += 64) {
      this.graphics.beginPath();
      this.graphics.moveTo(i, 0);
      this.graphics.lineTo(i, MAP_SIZE);
      this.graphics.strokePath();
      this.graphics.beginPath();
      this.graphics.moveTo(0, i);
      this.graphics.lineTo(MAP_SIZE, i);
      this.graphics.strokePath();
    }

    this.graphics.fillStyle(0x325f34, 0.88);
    for (const grass of this.grasses) {
      this.graphics.fillRect(grass.x, grass.y, grass.width, grass.height);
      this.graphics.fillStyle(0x3e753f, 0.45);
      this.graphics.fillRect(grass.x + 4, grass.y + 4, grass.width - 8, grass.height - 8);
      this.graphics.fillStyle(0x325f34, 0.88);
    }

    this.graphics.fillStyle(0x8fa4c1, 1);
    for (const wall of this.walls) {
      this.graphics.fillRect(wall.x, wall.y, wall.width, wall.height);
      this.graphics.lineStyle(2, 0x6f84a1, 1);
      this.graphics.strokeRect(wall.x, wall.y, wall.width, wall.height);
    }

    this.graphics.fillStyle(0x2d67c8, 0.88);
    for (const water of this.waters) {
      this.graphics.fillRect(water.x, water.y, water.width, water.height);
      this.graphics.lineStyle(2, 0x70b1ff, 0.55);
      this.graphics.strokeRect(water.x, water.y, water.width, water.height);
      this.graphics.fillStyle(0x81c6ff, 0.13);
      this.graphics.fillRect(water.x + 4, water.y + 4, water.width - 8, 8);
      this.graphics.fillStyle(0x2d67c8, 0.88);
    }

    if (this.zone.isStarted()) {
      this.graphics.lineStyle(5, 0xff6161, 1);
      this.graphics.strokeCircle(this.zone.centerX, this.zone.centerY, this.zone.radius);
      this.graphics.lineStyle(1, 0xffb3b3, 0.55);
      this.graphics.strokeCircle(this.zone.centerX, this.zone.centerY, Math.max(0, this.zone.radius - 8));
    }

    for (const crate of this.crates) {
      this.graphics.fillStyle(0x8f4618, 1);
      this.graphics.fillRect(crate.x - 16, crate.y - 16, 32, 32);
      this.graphics.lineStyle(2, 0xd08c5f, 0.95);
      this.graphics.strokeRect(crate.x - 16, crate.y - 16, 32, 32);
      const hpRatio = Phaser.Math.Clamp(crate.hp / 2000, 0, 1);
      this.graphics.fillStyle(0x0e1f1c, 0.75);
      this.graphics.fillRect(crate.x - 16, crate.y - 24, 32, 4);
      this.graphics.fillStyle(0x35d07b, 1);
      this.graphics.fillRect(crate.x - 16, crate.y - 24, 32 * hpRatio, 4);
    }

    for (const cube of this.cubes) {
      this.graphics.fillStyle(0x9de23a, 1);
      this.graphics.fillRect(cube.x - 6, cube.y - 6, 12, 12);
      this.graphics.fillStyle(0xe2ff8a, 0.9);
      this.graphics.fillRect(cube.x - 2, cube.y - 2, 4, 4);
    }

    for (const bullet of this.bullets) {
      const color = bullet.kind === "normal" ? 0xf8fafc : bullet.kind === "bomb" ? 0xffb020 : 0xff7a33;
      this.graphics.fillStyle(color, 1);
      this.graphics.fillCircle(bullet.x, bullet.y, bullet.radius);
      this.graphics.lineStyle(1, 0xffffff, 0.45);
      this.graphics.strokeCircle(bullet.x, bullet.y, Math.max(2, bullet.radius - 1));
    }

    for (const player of this.players.values()) {
      if (!player.alive) {
        continue;
      }
      const color =
        player.characterId === "gunner"
          ? 0x66b9ff
          : player.characterId === "bomber"
            ? 0xff8a3d
            : 0xffdc5a;
      this.graphics.fillStyle(color, 1);
      this.graphics.fillCircle(player.x, player.y, 14);
      this.graphics.lineStyle(2, 0x0b1428, 0.72);
      this.graphics.strokeCircle(player.x, player.y, 14);

      if (player.id === this.localPlayerId) {
        this.graphics.lineStyle(3, 0xffffff, 1);
        this.graphics.strokeCircle(player.x, player.y, 20);
        this.graphics.lineStyle(1, UI_THEME.colors.buttonStroke, 1);
        this.graphics.strokeCircle(player.x, player.y, 23);
      }

      const hpRatio = Phaser.Math.Clamp(player.hp / player.maxHp, 0, 1);
      this.graphics.fillStyle(0x101421, 0.85);
      this.graphics.fillRect(player.x - 18, player.y - 24, 36, 5);
      this.graphics.fillStyle(0x31d679, 1);
      this.graphics.fillRect(player.x - 18, player.y - 24, 36 * hpRatio, 5);
      this.graphics.fillStyle(0xffec8e, 1);
      this.graphics.fillRect(player.x - 18, player.y - 30, Math.min(30, player.cubes * 3), 3);
    }
  }

  private updateHud(): void {
    const local = this.players.get(this.localPlayerId);
    if (!local || !this.hud) {
      return;
    }

    const alive = [...this.players.values()].filter((item) => item.alive).length;
    this.hud.updateAlive(alive, MAX_PLAYERS);

    if (!this.zone.isStarted()) {
      this.hud.updateZone(`毒圈开始倒计时: ${Math.ceil(this.zone.getMsUntilStart() / 1000)}s`);
    } else if (this.zone.stage < 5) {
      this.hud.updateZone(`毒圈阶段 ${this.zone.stage} / 5, 下一次收缩: ${Math.ceil(this.zone.getMsUntilNextShrink() / 1000)}s`);
    } else {
      this.hud.updateZone("毒圈已到最终阶段");
    }

    this.hud.updateStatus(
      `HP ${Math.round(local.hp)}/${Math.round(local.maxHp)}  能量 ${local.cubes}  超级 ${Math.round(local.superCharge)}%`
    );
    this.ammoBar.update(local.ammo);
    this.updateBattlePanel(local, alive);

    this.miniMap.draw({
      players: [...this.players.values()].map((player) => ({
        x: player.x,
        y: player.y,
        teamId: player.teamId,
        alive: player.alive,
        isSelf: player.id === this.localPlayerId,
      })),
      zone: {
        centerX: this.zone.centerX,
        centerY: this.zone.centerY,
        radius: this.zone.radius,
      },
    });
  }

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
    this.zoneProgressFill.setScale(zoneProgress, 1).setFillStyle(zoneColor, 1);

    this.battleStatusText.setText(`排名预测 #${projectedRank}   击杀 ${local.kills}   存活 ${aliveCount}/${MAX_PLAYERS}`);
    this.battleMetaText.setText(`房间 ${roomLabel}   网络 ${networkLabel}   超级 ${Math.round(local.superCharge)}%`);

    const lowHp = local.hp / local.maxHp <= 0.35;
    this.battleStatusText.setColor(lowHp ? "#ffd2d9" : "#f6f3e8");
    this.battleMetaText.setColor(lowHp ? "#ffc0cc" : "#9dd9ff");

    if (this.dangerVignette) {
      if (!lowHp) {
        this.dangerVignette.setAlpha(0);
      } else {
        const ratio = local.hp / Math.max(1, local.maxHp);
        const base = Phaser.Math.Clamp((0.35 - ratio) * 0.8, 0.08, 0.28);
        const pulse = 0.75 + 0.25 * Math.sin(this.time.now / 120);
        this.dangerVignette.setAlpha(base * pulse);
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
      if (latest) {
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
    const authoritative = latest.players.find((item) => item.id === this.localPlayerId);
    if (!me || !authoritative) {
      return;
    }

    const reconciled = reconcilePrediction(
      { x: me.x, y: me.y },
      { x: authoritative.x, y: authoritative.y },
      36
    );
    me.x = reconciled.x;
    me.y = reconciled.y;
  }

  private buildWorldSnapshot(): GameSnapshot {
    const players = [...this.players.values()].map((player) => ({
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
    }));

    const bullets = this.bullets.map((bullet) => ({
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
    }));

    return {
      tick: this.inputSeq,
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
      aliveCount: players.filter((item) => item.alive).length,
    };
  }

  private setupNetwork(): void {
    const session = getSession();
    const signaling = getSignalingClient();

    this.peerManager = new PeerManager();
    this.peerManager.onSignal = (peerId, type, payload) => {
      signaling.send({
        type,
        target: peerId,
        payload,
      });
    };

    this.peerManager.onData = (peerId, data) => {
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
        this.snapshotBuffer.push(snapshot);
        this.applyNetworkSnapshot(snapshot);
      } catch {
        void 0;
      }
    };

    signaling.onMessage = (message) => {
      if (message.type !== "signal") {
        return;
      }
      void this.handleSignalMessage(message.from, message.signalType, message.payload);
    };

    if (this.hostPlayer) {
      void this.createOffersForPeers(session.lobbyPlayers.map((player) => player.id));
    }
  }

  private async createOffersForPeers(peerIds: string[]): Promise<void> {
    if (!this.peerManager) {
      return;
    }

    const signaling = getSignalingClient();
    for (const peerId of peerIds) {
      if (peerId === this.localPlayerId) {
        continue;
      }
      try {
        const offer = await this.peerManager.createOffer(peerId);
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
    if (!this.peerManager) {
      return;
    }

    const signaling = getSignalingClient();
    if (signalType === "offer") {
      const answer = await this.peerManager.handleOffer(from, payload as RTCSessionDescriptionInit);
      signaling.send({
        type: "answer",
        target: from,
        payload: answer,
      });
      return;
    }

    if (signalType === "answer") {
      await this.peerManager.handleAnswer(from, payload as RTCSessionDescriptionInit);
      return;
    }

    await this.peerManager.handleIceCandidate(from, payload as RTCIceCandidateInit);
  }

  private applyNetworkSnapshot(snapshot: GameSnapshot): void {
    this.zone.sync(snapshot.zone);

    const seen = new Set<string>();
    for (const playerState of snapshot.players) {
      seen.add(playerState.id);
      const existing = this.players.get(playerState.id);
      if (!existing) {
        this.players.set(
          playerState.id,
          new Player({
            id: playerState.id,
            name: playerState.name,
            x: playerState.x,
            y: playerState.y,
            characterId: playerState.characterId,
            baseHp: playerState.maxHp,
            speed: getCharacterById(playerState.characterId).speed,
            teamId: playerState.teamId,
            isBot: false,
          })
        );
      }

      const target = this.players.get(playerState.id);
      if (!target) {
        continue;
      }
      target.x = playerState.x;
      target.y = playerState.y;
      target.hp = playerState.hp;
      target.maxHp = playerState.maxHp;
      target.ammo = playerState.ammo;
      target.superCharge = playerState.superCharge;
      target.cubes = playerState.cubes;
      target.kills = playerState.kills;
      target.damageDone = playerState.damageDone;
      target.alive = playerState.alive;
    }

    for (const id of [...this.players.keys()]) {
      if (!seen.has(id)) {
        this.players.delete(id);
      }
    }

    this.bullets = snapshot.bullets.map(
      (bullet) =>
        new Bullet({
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
        })
    );
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
