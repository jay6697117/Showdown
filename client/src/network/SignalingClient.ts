export class SignalingClient {
  private ws: WebSocket | null = null;
  onMessage: (msg: unknown) => void = () => {};

  connect(url: string): void {
    this.ws = new WebSocket(url);
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string);
      this.onMessage(msg);
    };
  }

  send(msg: object): void {
    this.ws?.send(JSON.stringify(msg));
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}
