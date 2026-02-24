export function chooseBotTarget(
  bot: { x: number; y: number },
  targets: Array<{ id: string; x: number; y: number }>
): string | null {
  if (targets.length === 0) return null;

  let nearest = targets[0];
  let minDist = distSq(bot, nearest);

  for (let i = 1; i < targets.length; i++) {
    const d = distSq(bot, targets[i]);
    if (d < minDist) {
      minDist = d;
      nearest = targets[i];
    }
  }

  return nearest.id;
}

export function computeBotInput(params: {
  bot: { x: number; y: number };
  target: { x: number; y: number } | null;
  attackRange: number;
}): { dx: number; dy: number; shouldAttack: boolean } {
  if (!params.target) {
    return { dx: 0, dy: 0, shouldAttack: false };
  }

  const dx = params.target.x - params.bot.x;
  const dy = params.target.y - params.bot.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance === 0) {
    return { dx: 0, dy: 0, shouldAttack: true };
  }

  const nx = dx / distance;
  const ny = dy / distance;

  if (distance < params.attackRange * 0.75) {
    return { dx: -nx, dy: -ny, shouldAttack: true };
  }

  return {
    dx: nx,
    dy: ny,
    shouldAttack: distance <= params.attackRange * 1.2,
  };
}

function distSq(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
