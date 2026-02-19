import { describe, expect, it } from "vitest";
import { SignalingHandler, SignalMessage } from "../SignalingHandler";

describe("SignalingHandler", () => {
  it("routes offer to target peer", () => {
    const handler = new SignalingHandler();
    const sent: SignalMessage[] = [];
    handler.onSend = (target, msg) => sent.push({ ...msg, target });

    handler.handleMessage("peer-a", {
      type: "offer",
      target: "peer-b",
      sdp: "fake-sdp",
    });

    expect(sent).toHaveLength(1);
    expect(sent[0].target).toBe("peer-b");
    expect(sent[0].type).toBe("offer");
  });
});
