import { describe, expect, it } from "vitest";
import { formatAliveCounter } from "../HUD";

describe("HUD", () => {
  it("formats alive counter", () => {
    expect(formatAliveCounter(7, 10)).toBe("存活: 7/10");
  });

  it("formats zero alive", () => {
    expect(formatAliveCounter(0, 10)).toBe("存活: 0/10");
  });
});
