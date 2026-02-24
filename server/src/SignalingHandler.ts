import type { HostToClientMessage } from "shared";

export interface SignalRelayMessage {
  type: "offer" | "answer" | "ice-candidate";
  target: string;
  payload: unknown;
}

export class SignalingHandler {
  onSend: (target: string, msg: HostToClientMessage) => void = () => {};

  handleMessage(from: string, msg: SignalRelayMessage): void {
    this.onSend(msg.target, {
      type: "signal",
      from,
      signalType: msg.type,
      payload: msg.payload,
    });
  }
}
