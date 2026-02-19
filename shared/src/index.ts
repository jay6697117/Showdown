export { GAME_TICK_RATE, MAP_SIZE, MAX_PLAYERS, AMMO_MAX, AMMO_REGEN_MS } from "./constants";
export type { InputPacket } from "./protocol";
export { encodeInputPacket, decodeInputPacket } from "./protocol";
export type { PlayerId, PlayerState, BulletState, GameSnapshot } from "./types";
