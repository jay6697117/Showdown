import Phaser from "phaser";
import { MainMenu } from "./scenes/MainMenu";
import { Lobby } from "./scenes/Lobby";
import { Game } from "./scenes/Game";
import { Result } from "./scenes/Result";

export function createGameConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    width: 1280,
    height: 1280,
    scene: [MainMenu, Lobby, Game, Result],
    physics: { default: "arcade", arcade: { debug: false } },
  };
}
