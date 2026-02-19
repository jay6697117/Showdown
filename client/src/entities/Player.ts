import Phaser from "phaser";

export class Player extends Phaser.Physics.Arcade.Sprite {
  playerId: string;
  hp: number;
  ammo: number;
  superCharge: number;
  speed: number;

  constructor(scene: Phaser.Scene, x: number, y: number, playerId: string) {
    super(scene, x, y, "player");
    this.playerId = playerId;
    this.hp = 3200;
    this.ammo = 3;
    this.superCharge = 0;
    this.speed = 200;
    scene.add.existing(this);
    scene.physics.add.existing(this);
  }
}
