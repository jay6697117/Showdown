export function computeAliveCount(players: Array<{ hp: number }>): number {
  return players.filter((p) => p.hp > 0).length;
}

export function getWinner(players: Array<{ id: string; hp: number }>): string | null {
  const alive = players.filter((p) => p.hp > 0);
  return alive.length === 1 ? alive[0].id : null;
}
