import { describe, expect, it } from "vitest";
import { crateDropPowerCube } from "../Crate";

describe("Crate", () => {
  it("drops power cubes on destroy", () => {
    const cubes = crateDropPowerCube(3);
    expect(cubes).toBe(3);
  });
});
