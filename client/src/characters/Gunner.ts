import type { CharacterDef } from "./index";

export const GUNNER: CharacterDef = {
  id: "gunner",
  name: "Gunner",
  hp: 3200,
  ammoMax: 3,
  attackDamage: 300,
  attackRange: 520,
  speed: 220,
  superName: "翻滚冲刺",
  superDamage: 0,
  attackPattern: "spread",
  superPattern: "dash",
};
