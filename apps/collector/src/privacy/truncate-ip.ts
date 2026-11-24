import { isIPv4, isIPv6 } from "node:net";

const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

function truncateIpv4(ip: string): string {
  const [a, b, c] = ip.split(".");
  return `${a}.${b}.${c}.0`;
}

/** Expands an IPv6 address to 8 hextets. Input must already pass `isIPv6`. */
function expandIpv6(ip: string): string[] {
  const [head = "", tail] = ip.split("::");
  const headParts = head === "" ? [] : head.split(":");
  if (tail === undefined) {
    return headParts;
  }
  const tailParts = tail === "" ? [] : tail.split(":");
  const fill = Array.from({ length: 8 - headParts.length - tailParts.length }, () => "0");
  return [...headParts, ...fill, ...tailParts];
}

/**
 * Truncates a client IP before storage (ADR-0009): IPv4 keeps 24 bits, IPv6 keeps 48 bits,
 * IPv4-mapped IPv6 is treated as IPv4. Returns `undefined` for anything that is not an IP.
 * Pure: never throws.
 */
export function truncateIp(ip: string | undefined): string | undefined {
  if (ip === undefined) {
    return undefined;
  }
  const trimmed = ip.trim();
  const mapped = IPV4_MAPPED.exec(trimmed)?.[1];
  if (mapped !== undefined && isIPv4(mapped)) {
    return truncateIpv4(mapped);
  }
  if (isIPv4(trimmed)) {
    return truncateIpv4(trimmed);
  }
  if (isIPv6(trimmed) && !trimmed.includes(".") && !trimmed.includes("%")) {
    const hextets = expandIpv6(trimmed)
      .slice(0, 3)
      .map((h) => h.toLowerCase().replace(/^0+(?=.)/, ""));
    return `${hextets.join(":")}::`;
  }
  return undefined;
}
