export {
  GAME_TICK_RATE,
  MAP_SIZE,
  MAX_PLAYERS,
  AMMO_MAX,
  AMMO_REGEN_MS,
  POWER_CUBE_MAX,
  POWER_CUBE_HP_BONUS,
  POWER_CUBE_DAMAGE_BONUS,
  ZONE_START_DELAY_MS,
  ZONE_SHRINK_INTERVAL_MS,
  ZONE_MAX_STAGE,
  SUPER_CHARGE_PER_HIT,
  SUPER_CHARGE_MAX,
} from "./constants";
export type {
  InputPacket,
  ClientToHostMessage,
  HostToClientMessage,
  RoomStatePayload,
  RoomPlayerPayload,
} from "./protocol";
export {
  encodeInputPacket,
  decodeInputPacket,
  encodeSnapshot,
  decodeSnapshot,
} from "./protocol";
export type {
  PlayerId,
  CharacterId,
  GameMode,
  PlayerState,
  BulletState,
  ZoneState,
  GameSnapshot,
  MatchResult,
} from "./types";
