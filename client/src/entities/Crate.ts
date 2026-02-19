/** Returns the number of power cubes dropped when a crate is destroyed */
export function crateDropPowerCube(cubeCount: number): number {
  return cubeCount;
}

export class Crate {
  hp = 2000;
  x: number;
  y: number;
  cubeCount: number;

  constructor(x: number, y: number, cubeCount = 1) {
    this.x = x;
    this.y = y;
    this.cubeCount = cubeCount;
  }

  takeDamage(amount: number): boolean {
    this.hp -= amount;
    return this.hp <= 0;
  }
}
