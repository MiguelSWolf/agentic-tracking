import { describe, expect, it } from "vitest";
import { truncateIp } from "./truncate-ip.js";

describe("truncateIp", () => {
  it("IPv4 address › keeps the first 24 bits", () => {
    expect(truncateIp("203.0.113.77")).toBe("203.0.113.0");
  });

  it("IPv6 address › keeps the first 48 bits", () => {
    expect(truncateIp("2001:db8:abcd:12:34:56:78:9a")).toBe("2001:db8:abcd::");
  });

  it("compressed IPv6 address › expands before truncating", () => {
    expect(truncateIp("2001:db8::1")).toBe("2001:db8:0::");
  });

  it("IPv6 with leading zeros and upper case › normalises the kept hextets", () => {
    expect(truncateIp("2001:0DB8:00AB::5")).toBe("2001:db8:ab::");
  });

  it("IPv4-mapped IPv6 › is truncated as IPv4", () => {
    expect(truncateIp("::ffff:203.0.113.77")).toBe("203.0.113.0");
  });

  it.each([undefined, "", "not-an-ip", "999.1.1.1", "fe80::1%eth0"])(
    "invalid input %s › returns undefined",
    (input) => {
      expect(truncateIp(input)).toBeUndefined();
    },
  );
});
