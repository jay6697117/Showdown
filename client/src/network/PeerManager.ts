export class PeerManager {
  private static readonly MAX_PENDING_ICE_CANDIDATES = 96;
  private peers = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();
  private pendingIceCandidates = new Map<string, RTCIceCandidateInit[]>();
  private pendingIceCandidateKeys = new Map<string, Set<string>>();
  private peerOperations = new Map<string, Promise<void>>();
  private isClosed = false;
  onData: (peerId: string, data: string) => void = () => {};
  onSignal: (peerId: string, type: "offer" | "answer" | "ice-candidate", payload: unknown) => void = () => {};
  onPeerDisconnected: (peerId: string) => void = () => {};

  async createOffer(peerId: string): Promise<RTCSessionDescriptionInit> {
    if (this.isClosed) {
      return Promise.reject(new Error("PeerManager is closed"));
    }
    const pc = this.createPeerConnection(peerId);
    const channel = pc.createDataChannel("game");
    this.setupDataChannel(peerId, channel);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return offer;
  }

  async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (this.isClosed) {
      return Promise.reject(new Error("PeerManager is closed"));
    }
    return this.withPeerOperation(peerId, async () => {
      const pc = this.createPeerConnection(peerId);
      pc.ondatachannel = (event) => this.setupDataChannel(peerId, event.channel);
      await pc.setRemoteDescription(offer);
      await this.flushPendingIceCandidates(peerId, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      return answer;
    });
  }

  async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    if (this.isClosed) {
      return;
    }
    return this.withPeerOperation(peerId, async () => {
      const pc = this.peers.get(peerId);
      if (!pc) {
        return;
      }
      await pc.setRemoteDescription(answer);
      await this.flushPendingIceCandidates(peerId, pc);
    });
  }

  async handleIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    if (this.isClosed) {
      return;
    }
    return this.withPeerOperation(peerId, async () => {
      const pc = this.peers.get(peerId);
      if (!pc || !pc.remoteDescription) {
        this.queueIceCandidate(peerId, candidate);
        return;
      }

      await this.addIceCandidateWithRecovery(peerId, pc, candidate);
    });
  }

  send(peerId: string, data: string): void {
    if (this.isClosed) {
      return;
    }

    const channel = this.dataChannels.get(peerId);
    if (!channel || channel.readyState !== "open") {
      return;
    }

    try {
      channel.send(data);
    } catch (error) {
      console.warn("Failed to send peer data", error);
    }
  }

  broadcast(data: string): void {
    if (this.isClosed) {
      return;
    }

    for (const channel of this.dataChannels.values()) {
      if (channel.readyState !== "open") {
        continue;
      }

      try {
        channel.send(data);
      } catch (error) {
        console.warn("Failed to broadcast peer data", error);
      }
    }
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    this.isClosed = false;

    const existingChannel = this.dataChannels.get(peerId);
    if (existingChannel) {
      existingChannel.onmessage = null;
      existingChannel.onclose = null;
      existingChannel.close();
      this.dataChannels.delete(peerId);
    }

    const existingPeer = this.peers.get(peerId);
    if (existingPeer) {
      existingPeer.onicecandidate = null;
      existingPeer.ondatachannel = null;
      existingPeer.close();
      this.peers.delete(peerId);
      this.pendingIceCandidates.delete(peerId);
      this.pendingIceCandidateKeys.delete(peerId);
      this.peerOperations.delete(peerId);
    }

    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.onSignal(peerId, "ice-candidate", event.candidate.toJSON());
      }
    };
    this.peers.set(peerId, pc);
    return pc;
  }

  private withPeerOperation<T>(peerId: string, operation: () => Promise<T>): Promise<T> {
    if (this.isClosed) {
      return Promise.reject(new Error("PeerManager is closed"));
    }

    const previous = this.peerOperations.get(peerId) ?? Promise.resolve();

    const run = previous
      .catch(() => {
        void 0;
      })
      .then(operation);

    this.peerOperations.set(
      peerId,
      run
        .then(() => {
          void 0;
        })
        .catch(() => {
          void 0;
        })
    );

    return run;
  }

  private candidateKey(candidate: RTCIceCandidateInit): string {
    const mid = candidate.sdpMid ?? "";
    const lineIndex = candidate.sdpMLineIndex ?? -1;
    const value = candidate.candidate ?? "";
    const usernameFragment = candidate.usernameFragment ?? "";
    return `${mid}:${lineIndex}:${usernameFragment}:${value}`;
  }

  private queueIceCandidate(peerId: string, candidate: RTCIceCandidateInit): void {
    let candidateKeys = this.pendingIceCandidateKeys.get(peerId);
    if (!candidateKeys) {
      candidateKeys = new Set<string>();
      this.pendingIceCandidateKeys.set(peerId, candidateKeys);
    }

    const key = this.candidateKey(candidate);
    if (candidateKeys.has(key)) {
      return;
    }

    candidateKeys.add(key);
    const pending = this.pendingIceCandidates.get(peerId);
    if (pending) {
      if (pending.length >= PeerManager.MAX_PENDING_ICE_CANDIDATES) {
        const dropped = pending.shift();
        if (dropped) {
          candidateKeys.delete(this.candidateKey(dropped));
        }
      }
      pending.push(candidate);
      return;
    }
    this.pendingIceCandidates.set(peerId, [candidate]);
  }

  private async flushPendingIceCandidates(peerId: string, pc: RTCPeerConnection): Promise<void> {
    const pending = this.pendingIceCandidates.get(peerId);
    if (!pending || pending.length === 0 || !pc.remoteDescription) {
      return;
    }

    this.pendingIceCandidates.delete(peerId);
    this.pendingIceCandidateKeys.delete(peerId);
    for (let i = 0; i < pending.length; i++) {
      await this.addIceCandidateWithRecovery(peerId, pc, pending[i]);
    }
  }

  private async addIceCandidateWithRecovery(
    peerId: string,
    pc: RTCPeerConnection,
    candidate: RTCIceCandidateInit
  ): Promise<void> {
    try {
      await pc.addIceCandidate(candidate);
    } catch (error) {
      if (error instanceof Error && error.name === "InvalidStateError") {
        this.queueIceCandidate(peerId, candidate);
        return;
      }
      console.warn("Failed to add ICE candidate", error);
    }
  }

  private setupDataChannel(peerId: string, channel: RTCDataChannel): void {
    this.dataChannels.set(peerId, channel);
    channel.onmessage = (event) => this.onData(peerId, event.data as string);
    channel.onclose = () => {
      if (this.dataChannels.get(peerId) === channel) {
        this.dataChannels.delete(peerId);
      }
      this.onPeerDisconnected(peerId);
    };
  }

  close(): void {
    this.isClosed = true;

    for (const channel of this.dataChannels.values()) {
      channel.onmessage = null;
      channel.onclose = null;
      channel.close();
    }
    for (const pc of this.peers.values()) {
      pc.onicecandidate = null;
      pc.ondatachannel = null;
      pc.close();
    }
    this.dataChannels.clear();
    this.peers.clear();
    this.pendingIceCandidates.clear();
    this.pendingIceCandidateKeys.clear();
    this.peerOperations.clear();
    this.onData = () => {};
    this.onSignal = () => {};
    this.onPeerDisconnected = () => {};
  }
}
