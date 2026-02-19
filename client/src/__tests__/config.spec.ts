import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  default: { AUTO: 0, Scene: class {} },
  Scene: class {},
}));

// Must import after mock
const { createGameConfig } = await import("../config");

describe("createGameConfig", () => {
  it("uses 1280x1280 camera world and 4 scenes", () => {
    const config = createGameConfig();
    expect(config.width).toBe(1280);
    expect(config.height).toBe(1280);
    expect(config.scene).toHaveLength(4);
  });
});
