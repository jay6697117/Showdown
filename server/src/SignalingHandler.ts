export interface SignalMessage {
  type: "offer" | "answer" | "ice-candidate";
  target: string;
  sdp?: string;
  candidate?: string;
}

export class SignalingHandler {
  onSend: (target: string, msg: SignalMessage) => void = () => {};

  handleMessage(from: string, msg: SignalMessage): void {
    this.onSend(msg.target, {
      ...msg,
      target: msg.target,
    });
  }
}
