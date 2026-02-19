export function canStartCountdown(players: Array<{ ready: boolean }>): boolean {
  return players.length > 1 && players.every((p) => p.ready);
}
