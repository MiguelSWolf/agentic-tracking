import { describe, expect, it } from "vitest";
import { resolveClientIp } from "./client-ip.js";

describe("resolveClientIp", () => {
  it("two trusted hops and three entries › takes the second from the right", () => {
    expect(resolveClientIp("1.1.1.1, 2.2.2.2, 3.3.3.3", "10.0.0.1", 2)).toBe("2.2.2.2");
  });

  it("zero trusted hops › ignores the header and uses the socket", () => {
    expect(resolveClientIp("1.1.1.1", "10.0.0.1", 0)).toBe("10.0.0.1");
  });

  it("header shorter than the hop count › falls back to the socket", () => {
    expect(resolveClientIp("1.1.1.1", "10.0.0.1", 2)).toBe("10.0.0.1");
  });

  it("IPv4-mapped IPv6 socket address › unwrapped", () => {
    expect(resolveClientIp(undefined, "::ffff:10.0.0.1", 1)).toBe("10.0.0.1");
  });
});
