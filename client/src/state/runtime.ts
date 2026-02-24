import { SignalingClient } from "../network/SignalingClient";

let signalingClient: SignalingClient | null = null;

export function getSignalingClient(): SignalingClient {
  if (!signalingClient) {
    signalingClient = new SignalingClient();
  }
  return signalingClient;
}

export function resetSignalingClient(): void {
  signalingClient?.close();
  signalingClient = null;
}
