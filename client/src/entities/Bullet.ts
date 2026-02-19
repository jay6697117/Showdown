import Phaser from "phaser";

export class Bullet extends Phaser.Physics.Arcade.Sprite {
  ownerId: string;
  damage: number;

  constructor(scene: Phaser.Scene, x: number, y: number, ownerId: string, damage: number) {
    super(scene, x, y, "bullet");
    this.ownerId = ownerId;
    this.damage = damage;
    scene.add.existing(this);
    scene.physics.add.existing(this);
  }
}
