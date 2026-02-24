export function crateDropPowerCube(cubeCount: number): number {
  return cubeCount;
}

export class Crate {
  id: string;
  hp = 2000;
  x: number;
  y: number;
  cubeCount: number;

  constructor(id: string, x: number, y: number, cubeCount = 1) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.cubeCount = cubeCount;
  }

  takeDamage(amount: number): boolean {
    this.hp -= amount;
    return this.hp <= 0;
  }
}
