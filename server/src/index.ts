import { WebSocketServer } from "ws";
import { RoomManager } from "./RoomManager";
import { SignalingHandler } from "./SignalingHandler";

const PORT = Number(process.env.PORT) || 3000;

const wss = new WebSocketServer({ port: PORT });
const roomManager = new RoomManager();
const signaling = new SignalingHandler();

const clients = new Map<string, import("ws").WebSocket>();

wss.on("connection", (ws) => {
  const id = crypto.randomUUID();
  clients.set(id, ws);

  signaling.onSend = (target, msg) => {
    const targetWs = clients.get(target);
    if (targetWs) targetWs.send(JSON.stringify(msg));
  };

  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());

    switch (msg.type) {
      case "create-room": {
        const room = roomManager.createRoom(id);
        ws.send(JSON.stringify({ type: "room-created", code: room.code }));
        break;
      }
      case "join-room": {
        const ok = roomManager.joinRoom(msg.code, id);
        ws.send(JSON.stringify({ type: "join-result", ok, code: msg.code }));
        break;
      }
      case "offer":
      case "answer":
      case "ice-candidate":
        signaling.handleMessage(id, msg);
        break;
    }
  });

  ws.on("close", () => {
    clients.delete(id);
  });
});

console.log(`Signaling server running on port ${PORT}`);
