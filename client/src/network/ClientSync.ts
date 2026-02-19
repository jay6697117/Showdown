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
