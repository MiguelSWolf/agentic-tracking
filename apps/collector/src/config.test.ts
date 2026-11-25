import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

const DATABASE_URL = "postgres://tracking:s3cret@localhost:5432/tracking";

describe("loadConfig", () => {
  it("missing DATABASE_URL › throws at startup", () => {
    expect(() => loadConfig({})).toThrow("DATABASE_URL");
  });

  it("only DATABASE_URL set › applies the documented defaults", () => {
    const config = loadConfig({ DATABASE_URL });

    expect(config).toEqual({
      databaseUrl: DATABASE_URL,
      host: "127.0.0.1",
      port: 3001,
      maxBodyBytes: 262144,
      trustedProxyHops: 1,
      shutdownTimeoutMs: 10000,
      logLevel: "info",
    });
  });

  it("non-numeric COLLECTOR_MAX_BODY_BYTES › throws", () => {
    expect(() => loadConfig({ DATABASE_URL, COLLECTOR_MAX_BODY_BYTES: "lots" })).toThrow(
      "COLLECTOR_MAX_BODY_BYTES",
    );
  });

  it("invalid DATABASE_URL › error message does not contain the value", () => {
    expect(() => loadConfig({ DATABASE_URL: "s3cret-not-a-url" })).not.toThrow(/s3cret/);
  });
});
