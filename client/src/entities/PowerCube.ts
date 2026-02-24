export class PowerCube {
  id: string;
  x: number;
  y: number;
  value: number;
  collected: boolean;

  constructor(id: string, x: number, y: number, value = 1) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.value = value;
    this.collected = false;
  }
}
