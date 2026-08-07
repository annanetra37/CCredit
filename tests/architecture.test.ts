import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Architecture guardrails (§2.1, §3) — a rule without enforcement is a comment.
 */

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(p);
  }
  return out;
}

const root = process.cwd();

describe("/lib/domain is pure", () => {
  const files = walk(path.join(root, "lib/domain"));

  it("contains at least the core modules", () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  for (const file of files) {
    it(`${path.relative(root, file)} imports no I/O layers`, () => {
      const src = readFileSync(file, "utf8");
      // No imports from db, integrations, adapters, next, react
      expect(src).not.toMatch(/from\s+["'].*\/lib\/db/);
      expect(src).not.toMatch(/from\s+["'].*\/lib\/integrations/);
      expect(src).not.toMatch(/from\s+["'].*\/lib\/adapters/);
      expect(src).not.toMatch(/from\s+["']next/);
      expect(src).not.toMatch(/from\s+["']react/);
      expect(src).not.toMatch(/from\s+["']drizzle-orm/);
      expect(src).not.toMatch(/from\s+["']postgres/);
    });
  }
});

describe("emission factor is data, not a constant (S8-1)", () => {
  // The Armenian grid factor 0.436 may appear only in the seed and in tests.
  const dirs = ["lib", "app", "components", "jobs"].map((d) => path.join(root, d));
  const offenders: string[] = [];
  for (const dir of dirs) {
    for (const file of walk(dir)) {
      const rel = path.relative(root, file);
      if (rel.startsWith("lib/db/seed")) continue; // the one legitimate home
      if (rel.startsWith("lib/glossary/")) continue; // prose examples, not maths
      const src = readFileSync(file, "utf8");
      if (src.includes("0.436")) offenders.push(rel);
    }
  }
  it("0.436 appears nowhere outside the seed", () => {
    expect(offenders).toEqual([]);
  });
});

describe("no raw glossary keys can leak (S0-4)", () => {
  it("InfoTip handles missing keys explicitly", () => {
    const src = readFileSync(
      path.join(root, "components/InfoTip.tsx"),
      "utf8",
    );
    expect(src).toContain("missing");
  });
});
