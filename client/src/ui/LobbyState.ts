export function canStartCountdown(players: Array<{ id: string; ready: boolean }>): boolean {
  return players.length > 1 && players.every((p) => p.ready);
}
