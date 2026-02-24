import { GAME_TICK_RATE } from "shared";
import type { GameSnapshot, InputPacket, PlayerState, ZoneState } from "shared";

export function applyInputInOrder(
  state: { lastSeq: number; x: number; y: number },
  input: { seq: number; dx: number; dy: number }
) {
  if (input.seq <= state.lastSeq) {
    return state;
  }

  return {
    ...state,
    lastSeq: input.seq,
    x: state.x + input.dx,
    y: state.y + input.dy,
  };
}

type HostPlayerState = {
  lastSeq: number;
  x: number;
  y: number;
  hp: number;
  ammo: number;
  superCharge: number;
  cubes: number;
  kills: number;
  damageDone: number;
  alive: boolean;
  teamId: string;
  characterId: "gunner" | "bomber" | "brawler";
  name: string;
};

export class HostAuthority {
  private tick = 0;
  private accumulator = 0;
  private readonly frameMs = 1000 / GAME_TICK_RATE;
  private readonly players = new Map<string, HostPlayerState>();
  private readonly inputQueue = new Map<string, InputPacket[]>();
  private zone: ZoneState;

  constructor(zone: ZoneState) {
    this.zone = zone;
  }

  registerPlayer(id: string, player: Omit<HostPlayerState, "lastSeq">): void {
    this.players.set(id, { ...player, lastSeq: 0 });
  }

  enqueueInput(playerId: string, input: InputPacket): void {
    const q = this.inputQueue.get(playerId) ?? [];
    q.push(input);
    this.inputQueue.set(playerId, q);
  }

  update(deltaMs: number): GameSnapshot[] {
    this.accumulator += deltaMs;
    const snapshots: GameSnapshot[] = [];

    while (this.accumulator >= this.frameMs) {
      this.accumulator -= this.frameMs;
      this.step();
      snapshots.push(this.makeSnapshot());
    }

    return snapshots;
  }

  setZone(zone: ZoneState): void {
    this.zone = zone;
  }

  private step(): void {
    this.tick += 1;

    for (const [playerId, player] of this.players.entries()) {
      if (!player.alive) {
        continue;
      }
      const queued = this.inputQueue.get(playerId) ?? [];
      queued.sort((a, b) => a.seq - b.seq);

      for (const input of queued) {
        const next = applyInputInOrder(
          { lastSeq: player.lastSeq, x: player.x, y: player.y },
          input
        );
        player.lastSeq = next.lastSeq;
        player.x = next.x;
        player.y = next.y;
      }

      this.inputQueue.set(playerId, []);
    }
  }

  private makeSnapshot(): GameSnapshot {
    const players: PlayerState[] = [];
    let aliveCount = 0;

    for (const [id, player] of this.players.entries()) {
      if (player.alive) {
        aliveCount += 1;
      }
      players.push({
        id,
        name: player.name,
        x: player.x,
        y: player.y,
        hp: player.hp,
        maxHp: player.hp,
        ammo: player.ammo,
        superCharge: player.superCharge,
        cubes: player.cubes,
        kills: player.kills,
        damageDone: player.damageDone,
        alive: player.alive,
        characterId: player.characterId,
        teamId: player.teamId,
      });
    }

    return {
      tick: this.tick,
      elapsedMs: Math.round(this.tick * this.frameMs),
      players,
      bullets: [],
      zone: this.zone,
      aliveCount,
    };
  }
}
