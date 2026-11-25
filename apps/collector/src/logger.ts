export type LogLevel = "debug" | "info" | "warn" | "error";

/** Scalar values only, so a caller cannot pass a request, a body or an error object by mistake. */
export type LogFields = Readonly<Record<string, string | number | boolean>>;

export type Logger = {
  readonly debug: (msg: string, fields?: LogFields) => void;
  readonly info: (msg: string, fields?: LogFields) => void;
  readonly warn: (msg: string, fields?: LogFields) => void;
  readonly error: (msg: string, fields?: LogFields) => void;
  readonly child: (bindings: LogFields) => Logger;
};

export type LogSink = { readonly write: (line: string) => unknown };

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * Keeps only `name`, `code`, `message` and `stack`. Drops pg fields such as `detail` and
 * `where`, which can echo row values (NODE-13, ES-09).
 */
export function serializeError(err: unknown): LogFields {
  if (!(err instanceof Error)) {
    return { errName: "NonError" };
  }
  const out: Record<string, string> = { errName: err.name, errMessage: err.message };
  if (err.stack !== undefined) {
    out.errStack = err.stack;
  }
  const code: unknown = (err as { code?: unknown }).code;
  if (typeof code === "string") {
    out.errCode = code;
  }
  return out;
}

/** JSON-lines logger (NODE-12). No dependency; see the PR for the trade-off. */
export function createLogger(options: {
  readonly level: LogLevel;
  readonly sink?: LogSink;
  readonly bindings?: LogFields;
}): Logger {
  const sink = options.sink ?? process.stdout;
  const bindings = options.bindings ?? {};

  const emit = (level: LogLevel, msg: string, fields?: LogFields): void => {
    if (ORDER[level] < ORDER[options.level]) {
      return;
    }
    const line = JSON.stringify({
      level,
      time: new Date().toISOString(),
      msg,
      ...bindings,
      ...fields,
    });
    sink.write(`${line}\n`);
  };

  return {
    debug: (msg, fields) => emit("debug", msg, fields),
    info: (msg, fields) => emit("info", msg, fields),
    warn: (msg, fields) => emit("warn", msg, fields),
    error: (msg, fields) => emit("error", msg, fields),
    child: (extra) =>
      createLogger({ level: options.level, sink, bindings: { ...bindings, ...extra } }),
  };
}
