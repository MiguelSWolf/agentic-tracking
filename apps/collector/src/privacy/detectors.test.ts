import { describe, expect, it } from "vitest";
import { looksPersonal } from "./detectors.js";

describe("looksPersonal", () => {
  it("returns true for an email-like string", () => {
    expect(looksPersonal("jane@example.com")).toBe(true);
  });

  it("returns true for a 9+ digit run even with separators", () => {
    expect(looksPersonal("+49 151-234-56789")).toBe(true);
  });

  it("returns false for short numbers and plain words", () => {
    expect(looksPersonal("pricing")).toBe(false);
    expect(looksPersonal("12345678")).toBe(false);
  });
});
