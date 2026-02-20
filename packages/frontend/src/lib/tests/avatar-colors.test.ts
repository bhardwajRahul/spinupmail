import { describe, expect, it } from "vitest";
import { getAvatarColors } from "../avatar-colors";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

describe("getAvatarColors", () => {
  it("returns deterministic 5-color palettes", () => {
    const first = getAvatarColors("seed-1", "dark");
    const second = getAvatarColors("seed-1", "dark");

    expect(first).toEqual(second);
    expect(first).toHaveLength(5);
    expect(first.every(color => HEX_COLOR.test(color))).toBe(true);
  });

  it("returns different palette families for light and dark mode", () => {
    const dark = getAvatarColors("seed-2", "dark");
    const light = getAvatarColors("seed-2", "light");

    expect(dark).not.toEqual(light);
  });
});
