import { AMMO_MAX, AMMO_REGEN_MS } from "shared";

export function regenAmmo(params: { ammo: number; elapsedMs: number }): number {
  const recovered = Math.floor(params.elapsedMs / AMMO_REGEN_MS);
  return Math.min(AMMO_MAX, params.ammo + recovered);
}

export function consumeAmmo(currentAmmo: number): number {
  return Math.max(0, currentAmmo - 1);
}
