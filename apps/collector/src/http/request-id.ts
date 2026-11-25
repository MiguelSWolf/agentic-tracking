const SAFE_ID = /^[A-Za-z0-9-]{8,64}$/;

/** Reuses an incoming `x-request-id` only if it is safe to log; otherwise generates one (NODE-14). */
export function resolveRequestId(
  incoming: string | string[] | undefined,
  generate: () => string,
): string {
  return typeof incoming === "string" && SAFE_ID.test(incoming) ? incoming : generate();
}
