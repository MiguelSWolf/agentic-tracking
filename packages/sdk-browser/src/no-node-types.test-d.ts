// Type-level proof (TRK-46): sdk-browser must not see Node types.
// `tsc --noEmit` checks this file. If Node types become visible, each
// directive below is unused and tsc fails with TS2578.
// Do not import "vitest" here: its declarations load @types/node.

// @ts-expect-error: sdk-browser must not see Node modules (TRK-46)
import type * as nodeFs from "node:fs";

// @ts-expect-error: sdk-browser must not see Node globals (TRK-46)
export type NodeProcess = typeof process;

export type NodeFs = typeof nodeFs;
