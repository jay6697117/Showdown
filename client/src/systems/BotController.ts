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

function distSq(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
