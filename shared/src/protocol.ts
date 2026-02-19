export { GAME_TICK_RATE } from "./constants";

export type InputPacket = {
  seq: number;
  dx: number;
  dy: number;
  attack: boolean;
  skill: boolean;
  aimX: number;
  aimY: number;
};

export function encodeInputPacket(input: InputPacket): string {
  return JSON.stringify(input);
}

export function decodeInputPacket(raw: string): InputPacket {
  return JSON.parse(raw) as InputPacket;
}
