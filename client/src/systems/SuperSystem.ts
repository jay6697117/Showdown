import { SUPER_CHARGE_MAX, SUPER_CHARGE_PER_HIT } from "shared";

const SUPER_THRESHOLD = SUPER_CHARGE_MAX;

export function chargeSuper(currentCharge: number, damageDealt: number): number {
  return Math.min(SUPER_THRESHOLD, currentCharge + damageDealt);
}

export function isSuperReady(charge: number): boolean {
  return charge >= SUPER_THRESHOLD;
}

export function consumeSuper(charge: number): number {
  return charge >= SUPER_THRESHOLD ? 0 : charge;
}

export function chargeSuperFromHit(currentCharge: number, hitCount = 1): number {
  return Math.min(SUPER_THRESHOLD, currentCharge + hitCount * SUPER_CHARGE_PER_HIT);
}
