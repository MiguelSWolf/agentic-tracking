function unwrapMapped(ip: string): string {
  return ip.toLowerCase().startsWith("::ffff:") && ip.includes(".") ? ip.slice(7) : ip;
}

/**
 * Picks the client IP. With `trustedHops = 0` it uses the socket address. Otherwise it takes the
 * `X-Forwarded-For` entry our own proxy appended (`length - trustedHops`), never the
 * client-controlled leftmost one. Falls back to the socket address if the header is missing or
 * too short. The result is only passed to `ingestBatch`, which truncates it; never log it.
 */
export function resolveClientIp(
  forwardedFor: string | string[] | undefined,
  socketAddress: string | undefined,
  trustedHops: number,
): string | undefined {
  const fallback = socketAddress === undefined ? undefined : unwrapMapped(socketAddress);
  if (trustedHops === 0 || forwardedFor === undefined) {
    return fallback;
  }
  const header = Array.isArray(forwardedFor) ? forwardedFor.join(",") : forwardedFor;
  const entries = header.split(",").map((entry) => entry.trim());
  const picked = entries[entries.length - trustedHops];
  if (entries.length < trustedHops || picked === undefined || picked === "") {
    return fallback;
  }
  return unwrapMapped(picked);
}
