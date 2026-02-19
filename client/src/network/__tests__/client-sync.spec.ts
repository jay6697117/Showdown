import { describe, expect, it } from "vitest";
import { interpolatePosition } from "../ClientSync";

describe("ClientSync", () => {
  it("interpolates between two snapshots", () => {
    const prev = { x: 0, y: 0 };
    const next = { x: 100, y: 200 };
    const result = interpolatePosition(prev, next, 0.5);
    expect(result.x).toBe(50);
    expect(result.y).toBe(100);
  });

  it("clamps interpolation factor", () => {
    const prev = { x: 0, y: 0 };
    const next = { x: 100, y: 100 };
    const result = interpolatePosition(prev, next, 1.5);
    expect(result.x).toBe(100);
    expect(result.y).toBe(100);
  });
});
