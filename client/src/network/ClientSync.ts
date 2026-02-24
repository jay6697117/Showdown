import type { GameSnapshot, InputPacket, PlayerState } from "shared";

export function interpolatePosition(
  prev: { x: number; y: number },
  next: { x: number; y: number },
  t: number
): { x: number; y: number } {
  const clamped = Math.min(1, Math.max(0, t));
  return {
    x: prev.x + (next.x - prev.x) * clamped,
    y: prev.y + (next.y - prev.y) * clamped,
  };
}

export class SnapshotBuffer {
  private snapshots: GameSnapshot[] = [];
  private maxSize = 60;

  push(snapshot: GameSnapshot): void {
    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSize) {
      this.snapshots.shift();
    }
  }

  latest(): GameSnapshot | null {
    return this.snapshots[this.snapshots.length - 1] ?? null;
  }

  getRenderPair(interpolationDelayTicks = 2): { prev: GameSnapshot; next: GameSnapshot } | null {
    if (this.snapshots.length < interpolationDelayTicks + 1) {
      return null;
    }
    const nextIndex = this.snapshots.length - interpolationDelayTicks;
    const prevIndex = Math.max(0, nextIndex - 1);
    const prev = this.snapshots[prevIndex];
    const next = this.snapshots[nextIndex];
    if (!prev || !next) {
      return null;
    }
    return { prev, next };
  }
}

export function reconcilePrediction(
  localState: { x: number; y: number },
  authoritative: { x: number; y: number },
  threshold = 24
): { x: number; y: number } {
  const dx = authoritative.x - localState.x;
  const dy = authoritative.y - localState.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > threshold) {
    return { ...authoritative };
  }

  return {
    x: localState.x + dx * 0.35,
    y: localState.y + dy * 0.35,
  };
}

export function applyPendingInputs(base: PlayerState, pending: InputPacket[]): PlayerState {
  let x = base.x;
  let y = base.y;
  for (const input of pending) {
    x += input.dx;
    y += input.dy;
  }
  return {
    ...base,
    x,
    y,
  };
}
