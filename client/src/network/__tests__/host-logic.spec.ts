import { describe, expect, it } from "vitest";
import { applyInputInOrder } from "../HostLogic";

describe("HostLogic", () => {
  it("drops out-of-order stale input", () => {
    const state = { lastSeq: 10, x: 0, y: 0 };
    const next = applyInputInOrder(state, { seq: 9, dx: 1, dy: 0 });
    expect(next.lastSeq).toBe(10);
    expect(next.x).toBe(0);
  });

  it("applies in-order input", () => {
    const state = { lastSeq: 5, x: 100, y: 200 };
    const next = applyInputInOrder(state, { seq: 6, dx: 10, dy: -5 });
    expect(next.lastSeq).toBe(6);
    expect(next.x).toBe(110);
    expect(next.y).toBe(195);
  });
});
