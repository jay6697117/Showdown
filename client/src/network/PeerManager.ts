export class PeerManager {
  private peers = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();
  onData: (peerId: string, data: string) => void = () => {};

  async createOffer(peerId: string): Promise<RTCSessionDescriptionInit> {
    const pc = this.createPeerConnection(peerId);
    const channel = pc.createDataChannel("game");
    this.setupDataChannel(peerId, channel);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return offer;
  }

  async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    const pc = this.createPeerConnection(peerId);
    pc.ondatachannel = (event) => this.setupDataChannel(peerId, event.channel);
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.peers.get(peerId);
    if (pc) await pc.setRemoteDescription(answer);
  }

  send(peerId: string, data: string): void {
    this.dataChannels.get(peerId)?.send(data);
  }

  broadcast(data: string): void {
    for (const channel of this.dataChannels.values()) {
      if (channel.readyState === "open") channel.send(data);
    }
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    this.peers.set(peerId, pc);
    return pc;
  }

  private setupDataChannel(peerId: string, channel: RTCDataChannel): void {
    this.dataChannels.set(peerId, channel);
    channel.onmessage = (event) => this.onData(peerId, event.data as string);
  }
}
