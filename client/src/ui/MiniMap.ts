export class MiniMap {
  width: number;
  height: number;

  constructor(width = 160, height = 160) {
    this.width = width;
    this.height = height;
  }

  worldToMiniMap(
    worldX: number,
    worldY: number,
    mapSize: number
  ): { x: number; y: number } {
    return {
      x: (worldX / mapSize) * this.width,
      y: (worldY / mapSize) * this.height,
    };
  }
}
