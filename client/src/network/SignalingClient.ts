import type { ClientToHostMessage, HostToClientMessage } from "shared";

export class SignalingClient {
  private ws: WebSocket | null = null;
  private connected = false;
  private connectPromise: Promise<void> | null = null;
  private connectAttemptId = 0;
  private pendingConnectReject?: (reason?: unknown) => void;
  onMessage: (msg: HostToClientMessage) => void = () => {};
  onOpen: () => void = () => {};
  onClose: () => void = () => {};
  onError: (err: Event) => void = () => {};

  connect(url: string): Promise<void> {
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    const attemptId = ++this.connectAttemptId;

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
    this.connectPromise = new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      let settled = false;

      const finalizeResolve = () => {
        if (settled) {
          return;
        }
        settled = true;
        this.connectPromise = null;
        this.pendingConnectReject = undefined;
        resolve();
      };

      const finalizeReject = (reason: unknown) => {
        if (settled) {
          return;
        }
        settled = true;
        this.connectPromise = null;
        this.pendingConnectReject = undefined;
        reject(reason);
      };

      this.pendingConnectReject = (reason?: unknown) => {
        finalizeReject(reason ?? new Error("Connection cancelled"));
      };

      ws.onopen = () => {
        if (attemptId !== this.connectAttemptId || this.ws !== ws) {
          return;
        }
        this.connected = true;
        this.onOpen();
        finalizeResolve();
      };

      ws.onmessage = (event) => {
        if (attemptId !== this.connectAttemptId || this.ws !== ws) {
          return;
        }
        try {
          const msg = JSON.parse(event.data as string) as HostToClientMessage;
          this.onMessage(msg);
        } catch (error) {
          console.warn("Failed to parse signaling message", error);
        }
      };

      ws.onclose = () => {
        if (attemptId !== this.connectAttemptId || this.ws !== ws) {
          return;
        }
        this.connected = false;
        if (!settled) {
          finalizeReject(new Error("WebSocket closed before connection established"));
          return;
        }
        this.onClose();
      };

      ws.onerror = (err) => {
        if (attemptId !== this.connectAttemptId || this.ws !== ws) {
          return;
        }
        this.connected = false;
        this.onError(err);
        if (!settled) {
          finalizeReject(err);
        }
      };
    });

    return this.connectPromise;
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
    this.connectAttemptId += 1;
    if (this.pendingConnectReject) {
      this.pendingConnectReject(new Error("Connection closed"));
    }
    this.connectPromise = null;

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
    }
    this.ws = null;
    this.connected = false;
  }
}
