import { describe, expect, it } from "vitest";
import { allowedTextPairs, tokens } from "@/lib/design/tokens";

/**
 * Accessibility is not negotiable here (§4.1). Every text/background pair must
 * clear WCAG AA: 4.5:1 for body text, 3:1 for large text and UI borders.
 * This test exists so a future palette tweak cannot silently break contrast.
 */

function srgbChannel(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (
    0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b)
  );
}

export function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

describe("design tokens meet WCAG AA", () => {
  for (const pair of allowedTextPairs) {
    const required = pair.large ? 3 : 4.5;
    it(`${pair.fg} on ${pair.bg} ≥ ${required}:1`, () => {
      const ratio = contrastRatio(tokens[pair.fg], tokens[pair.bg]);
      expect(ratio).toBeGreaterThanOrEqual(required);
    });
  }
});
