export interface CharacterDef {
  id: string;
  name: string;
  hp: number;
  ammoMax: number;
  attackDamage: number;
  attackRange: number;
  speed: number;
  superName: string;
  superDamage: number;
  attackPattern: "spread" | "lob" | "melee";
  superPattern: "dash" | "mega-bomb" | "charge";
}

export { GUNNER } from "./Gunner";
export { BOMBER } from "./Bomber";
export { BRAWLER } from "./Brawler";

import { GUNNER } from "./Gunner";
import { BOMBER } from "./Bomber";
import { BRAWLER } from "./Brawler";

const REGISTRY: Record<string, CharacterDef> = {
  [GUNNER.id]: GUNNER,
  [BOMBER.id]: BOMBER,
  [BRAWLER.id]: BRAWLER,
};

export function getCharacterById(id: string): CharacterDef {
  return REGISTRY[id] ?? GUNNER;
}

export function getAllCharacters(): CharacterDef[] {
  return [GUNNER, BOMBER, BRAWLER];
}
