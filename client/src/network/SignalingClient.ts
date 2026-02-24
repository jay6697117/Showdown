import type { ClientToHostMessage, HostToClientMessage } from "shared";

export class SignalingClient {
  private ws: WebSocket | null = null;
  private connected = false;
  onMessage: (msg: HostToClientMessage) => void = () => {};
  onOpen: () => void = () => {};
  onClose: () => void = () => {};
  onError: (err: Event) => void = () => {};

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        this.connected = true;
        this.onOpen();
        resolve();
      };
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data as string) as HostToClientMessage;
        this.onMessage(msg);
      };
      this.ws.onclose = () => {
        this.connected = false;
        this.onClose();
      };
      this.ws.onerror = (err) => {
        this.onError(err);
        reject(err);
      };
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  send(msg: ClientToHostMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(JSON.stringify(msg));
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }
}
