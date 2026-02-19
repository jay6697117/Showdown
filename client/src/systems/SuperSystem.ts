const SUPER_THRESHOLD = 3000;

export function chargeSuper(currentCharge: number, damageDealt: number): number {
  return currentCharge + damageDealt;
}

export function isSuperReady(charge: number): boolean {
  return charge >= SUPER_THRESHOLD;
}

export function consumeSuper(charge: number): number {
  return charge >= SUPER_THRESHOLD ? 0 : charge;
}
