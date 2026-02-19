export interface CharacterDef {
  id: string;
  hp: number;
  ammoMax: number;
  attackDamage: number;
  attackRange: number;
  speed: number;
  superName: string;
  superDamage: number;
}

export const GUNNER: CharacterDef = {
  id: "gunner",
  hp: 3200,
  ammoMax: 3,
  attackDamage: 420,
  attackRange: 600,
  speed: 200,
  superName: "弹幕风暴",
  superDamage: 1200,
};

export const BOMBER: CharacterDef = {
  id: "bomber",
  hp: 2800,
  ammoMax: 3,
  attackDamage: 780,
  attackRange: 400,
  speed: 180,
  superName: "超级炸弹",
  superDamage: 1800,
};

export const BRAWLER: CharacterDef = {
  id: "brawler",
  hp: 4800,
  ammoMax: 3,
  attackDamage: 500,
  attackRange: 200,
  speed: 220,
  superName: "冲锋突袭",
  superDamage: 800,
};
