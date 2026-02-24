import { WebSocketServer } from "ws";
import type { ClientToHostMessage, HostToClientMessage } from "shared";
import { RoomManager } from "./RoomManager";
import { SignalingHandler } from "./SignalingHandler";

const PORT = Number(process.env.PORT) || 3000;

const wss = new WebSocketServer({ port: PORT });
const roomManager = new RoomManager();
const signaling = new SignalingHandler();

const clients = new Map<string, import("ws").WebSocket>();
const startTimers = new Map<string, ReturnType<typeof setTimeout>>();

function sendToClient(targetId: string, message: HostToClientMessage): void {
  const socket = clients.get(targetId);
  if (!socket || socket.readyState !== 1) {
    return;
  }
  socket.send(JSON.stringify(message));
}

function broadcastRoomState(roomCode: string): void {
  const room = roomManager.getRoom(roomCode);
  if (!room) {
    return;
  }
  const payload = roomManager.toPayload(room);
  for (const player of room.players) {
    sendToClient(player.id, { type: "room-state", payload });
  }
}

function clearRoomStartTimer(roomCode: string): void {
  const timer = startTimers.get(roomCode);
  if (timer) {
    clearTimeout(timer);
    startTimers.delete(roomCode);
  }
}

function scheduleStartCountdown(roomCode: string): void {
  clearRoomStartTimer(roomCode);

  const room = roomManager.getRoom(roomCode);
  if (!room || !roomManager.canStart(roomCode)) {
    return;
  }

  const timer = setTimeout(() => {
    const latest = roomManager.getRoom(roomCode);
    if (!latest || !roomManager.canStart(roomCode)) {
      startTimers.delete(roomCode);
      return;
    }

    const message: HostToClientMessage = {
      type: "match-start",
      roomCode: latest.code,
      hostId: latest.hostId,
      mapId: latest.mapId,
      mode: latest.mode,
    };
    for (const player of latest.players) {
      sendToClient(player.id, message);
    }
    startTimers.delete(roomCode);
  }, 3000);

  startTimers.set(roomCode, timer);
}

signaling.onSend = (target, message) => {
  sendToClient(target, message);
};

wss.on("connection", (ws) => {
  const id = crypto.randomUUID();
  clients.set(id, ws);
  sendToClient(id, { type: "hello", playerId: id });

  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString()) as ClientToHostMessage;

    switch (msg.type) {
      case "create-room": {
        const room = roomManager.createRoom(
          { id, name: msg.name, characterId: msg.characterId },
          msg.mode
        );
        broadcastRoomState(room.code);
        break;
      }
      case "join-room": {
        const result = roomManager.joinRoom(msg.code, {
          id,
          name: msg.name,
          characterId: msg.characterId,
        });
        if (!result.ok) {
          sendToClient(id, { type: "error", message: result.reason ?? "加入房间失败" });
        } else {
          broadcastRoomState(msg.code);
        }
        break;
      }
      case "quick-match": {
        const existing = roomManager.getRoomByPlayer(id);
        if (existing) {
          broadcastRoomState(existing.code);
          break;
        }

        const joinable = roomManager.findJoinableRoom(msg.mode);
        if (joinable) {
          const result = roomManager.joinRoom(joinable.code, {
            id,
            name: msg.name,
            characterId: msg.characterId,
          });
          if (!result.ok) {
            sendToClient(id, { type: "error", message: result.reason ?? "快速匹配失败" });
            break;
          }
          broadcastRoomState(joinable.code);
          break;
        }

        const created = roomManager.createRoom(
          { id, name: msg.name, characterId: msg.characterId },
          msg.mode
        );
        broadcastRoomState(created.code);
        break;
      }
      case "ready": {
        const room = roomManager.getRoomByPlayer(id);
        if (!room) {
          sendToClient(id, { type: "error", message: "当前不在房间中" });
          break;
        }

        roomManager.setReady(room.code, id, msg.ready);
        broadcastRoomState(room.code);
        if (roomManager.canStart(room.code)) {
          scheduleStartCountdown(room.code);
        } else {
          clearRoomStartTimer(room.code);
        }
        break;
      }
      case "set-mode": {
        const ok = roomManager.setMode(msg.roomCode, msg.mode, id);
        if (!ok) {
          sendToClient(id, { type: "error", message: "切换模式失败（仅房主可操作）" });
          break;
        }
        clearRoomStartTimer(msg.roomCode);
        broadcastRoomState(msg.roomCode);
        break;
      }
      case "select-map": {
        const ok = roomManager.setMap(msg.roomCode, msg.mapId, id);
        if (!ok) {
          sendToClient(id, { type: "error", message: "切换地图失败（仅房主可操作）" });
          break;
        }
        broadcastRoomState(msg.roomCode);
        break;
      }
      case "start-match": {
        const room = roomManager.getRoom(msg.roomCode);
        if (!room) {
          sendToClient(id, { type: "error", message: "房间不存在" });
          break;
        }
        if (room.hostId !== id) {
          sendToClient(id, { type: "error", message: "仅房主可以开始" });
          break;
        }
        if (room.players.length < 2) {
          sendToClient(id, { type: "error", message: "至少2名玩家才能开始" });
          break;
        }

        const message: HostToClientMessage = {
          type: "match-start",
          roomCode: room.code,
          hostId: room.hostId,
          mapId: room.mapId,
          mode: room.mode,
        };
        for (const player of room.players) {
          sendToClient(player.id, message);
        }
        clearRoomStartTimer(room.code);
        break;
      }
      case "input": {
        break;
      }
      case "offer":
      case "answer":
      case "ice-candidate": {
        const sourceRoom = roomManager.getRoomByPlayer(id);
        const targetRoom = roomManager.getRoomByPlayer(msg.target);
        if (!sourceRoom || !targetRoom || sourceRoom.code !== targetRoom.code) {
          sendToClient(id, { type: "error", message: "信令转发失败：目标不在同一房间" });
          break;
        }

        signaling.handleMessage(id, {
          type: msg.type,
          target: msg.target,
          payload: msg.payload,
        });
        break;
      }
    }
  });

  ws.on("close", () => {
    clients.delete(id);

    const roomBeforeLeave = roomManager.getRoomByPlayer(id)?.code;

    const affectedRooms = roomManager.removePlayer(id);
    if (roomBeforeLeave && !roomManager.getRoom(roomBeforeLeave)) {
      clearRoomStartTimer(roomBeforeLeave);
    }
    for (const room of affectedRooms) {
      clearRoomStartTimer(room.code);
      if (roomManager.canStart(room.code)) {
        scheduleStartCountdown(room.code);
      }
      broadcastRoomState(room.code);
    }
  });
});

console.log(`Signaling server running on port ${PORT}`);
