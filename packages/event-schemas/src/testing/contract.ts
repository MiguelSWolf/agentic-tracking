import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

export const FIXTURES_DIR = fileURLToPath(new URL("../../fixtures/", import.meta.url));

const InvalidFixture = z.object({
  expected_path: z.array(z.union([z.string(), z.number()])),
  input: z.unknown(),
});

export type ValidCase = { name: string; input: unknown };
export type InvalidCase = {
  name: string;
  input: unknown;
  expectedPath: readonly (string | number)[];
};

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8"));
}

/** Loads one `<Type>.v<N>` fixture folder as tables for `it.each` (ES-06, TEST-15). */
export function loadFixtures(folder: string): { valid: ValidCase[]; invalid: InvalidCase[] } {
  const dir = join(FIXTURES_DIR, folder);
  const valid: ValidCase[] = [];
  const invalid: InvalidCase[] = [];
  for (const file of readdirSync(dir).sort()) {
    const name = file.replace(/\.json$/, "");
    if (name.startsWith("valid-")) {
      valid.push({ name, input: readJson(join(dir, file)) });
    } else if (name.startsWith("invalid-")) {
      const parsed = InvalidFixture.parse(readJson(join(dir, file)));
      invalid.push({ name, input: parsed.input, expectedPath: parsed.expected_path });
    } else {
      throw new Error(`Fixture ${folder}/${file} must start with 'valid-' or 'invalid-'`);
    }
  }
  if (valid.length < 2 || invalid.length < 2) {
    throw new Error(`${folder} needs at least 2 valid and 2 invalid fixtures`);
  }
  return { valid, invalid };
}

export function listFixtureFolders(): string[] {
  return readdirSync(FIXTURES_DIR).sort();
}
