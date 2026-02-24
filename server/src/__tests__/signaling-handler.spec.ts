import { describe, expect, it } from "vitest";
import type { HostToClientMessage } from "shared";
import { SignalingHandler } from "../SignalingHandler";

describe("SignalingHandler", () => {
  it("routes offer to target peer", () => {
    const handler = new SignalingHandler();
    const sent: Array<{ target: string; msg: HostToClientMessage }> = [];
    handler.onSend = (target, msg) => sent.push({ target, msg });

    handler.handleMessage("peer-a", {
      type: "offer",
      target: "peer-b",
      payload: { sdp: "fake-sdp" },
    });

    expect(sent).toHaveLength(1);
    expect(sent[0].target).toBe("peer-b");
    expect(sent[0].msg.type).toBe("signal");
    if (sent[0].msg.type === "signal") {
      expect(sent[0].msg.from).toBe("peer-a");
      expect(sent[0].msg.signalType).toBe("offer");
    }
  });
});
