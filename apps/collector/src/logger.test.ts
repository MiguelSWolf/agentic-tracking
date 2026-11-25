import { describe, expect, it } from "vitest";
import { createLogger, serializeError } from "./logger.js";

describe("serializeError", () => {
  it("pg-like error with detail › detail is not in the output", () => {
    const err = Object.assign(new Error("duplicate key"), {
      code: "23505",
      detail: "Key (event_id)=(jane@example.com) already exists.",
    });

    const out = JSON.stringify(serializeError(err));

    expect(out).toContain("23505");
    expect(out).not.toContain("jane@example.com");
  });
});

describe("createLogger", () => {
  it("child with bindings › merged into every line as JSON", () => {
    const lines: string[] = [];
    const log = createLogger({ level: "info", sink: { write: (l) => lines.push(l) } });

    log.child({ requestId: "req-12345678" }).info("hello", { status: 200 });

    expect(JSON.parse(lines[0] ?? "")).toMatchObject({
      level: "info",
      msg: "hello",
      requestId: "req-12345678",
      status: 200,
    });
  });

  it("level info › debug lines are dropped", () => {
    const lines: string[] = [];
    const log = createLogger({ level: "info", sink: { write: (l) => lines.push(l) } });

    log.debug("hidden");

    expect(lines).toEqual([]);
  });
});
