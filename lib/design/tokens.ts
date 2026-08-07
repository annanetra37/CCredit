/**
 * Design tokens as data (§4.1). The CSS variables in app/globals.css are the
 * runtime source; this module mirrors them so tests can assert contrast and
 * components can map semantic layers/statuses to tints without hard-coding hex.
 */
export const tokens = {
  "surface-0": "#FBFAF8",
  "surface-1": "#FFFFFF",
  "surface-2": "#F2F0EB",
  mist: "#E6F0EF",
  peach: "#FBEBE0",
  lilac: "#EDE8F5",
  mint: "#E2F0E7",
  butter: "#FAF0D8",
  blush: "#F8E5E5",
  "ink-900": "#1E2A2E",
  "ink-700": "#3D4C51",
  // Two tokens are darkened vs the build guide (§4.1) because the guide's own
  // hex values marginally fail its own WCAG AA rule — exactly what the
  // contrast test exists to catch: ink-500 was #6B7A7E (4.46:1 on white),
  // apricot-700 was #A05B2B (4.49:1 on peach).
  "ink-500": "#68777B",
  "ink-200": "#DCE1E0",
  "teal-600": "#256F6D",
  "apricot-700": "#9C5828",
  "lilac-700": "#63508F",
  "mint-700": "#33714F",
  "amber-700": "#846010",
  "rose-700": "#94404A",
} as const;

export type TokenName = keyof typeof tokens;

/**
 * Colour as meaning (§4.2): section tinting encodes which layer of the
 * pipeline the user is in.
 */
export type Layer = "measurement" | "energy" | "carbon" | "commercial";

export const layerTint: Record<Layer, TokenName> = {
  measurement: "mist",
  energy: "peach",
  carbon: "lilac",
  commercial: "surface-2",
};

export const layerAccent: Record<Layer, TokenName> = {
  measurement: "teal-600",
  energy: "apricot-700",
  carbon: "lilac-700",
  commercial: "ink-700",
};

/**
 * Every text/background pair the UI is allowed to produce. The contrast test
 * walks this list and asserts WCAG AA (4.5:1 body, 3:1 large/UI) so a future
 * palette tweak cannot silently break accessibility.
 */
export const allowedTextPairs: Array<{
  fg: TokenName;
  bg: TokenName;
  large?: boolean;
}> = [
  { fg: "ink-900", bg: "surface-0" },
  { fg: "ink-900", bg: "surface-1" },
  { fg: "ink-900", bg: "surface-2" },
  { fg: "ink-700", bg: "surface-0" },
  { fg: "ink-700", bg: "surface-1" },
  { fg: "ink-700", bg: "surface-2" },
  { fg: "ink-500", bg: "surface-1" },
  { fg: "ink-900", bg: "mist" },
  { fg: "ink-900", bg: "peach" },
  { fg: "ink-900", bg: "lilac" },
  { fg: "ink-900", bg: "mint" },
  { fg: "ink-900", bg: "butter" },
  { fg: "ink-900", bg: "blush" },
  { fg: "teal-600", bg: "surface-1" },
  { fg: "teal-600", bg: "mist" },
  { fg: "apricot-700", bg: "peach" },
  { fg: "apricot-700", bg: "surface-1" },
  { fg: "lilac-700", bg: "lilac" },
  { fg: "lilac-700", bg: "surface-1" },
  { fg: "mint-700", bg: "mint" },
  { fg: "mint-700", bg: "surface-1" },
  { fg: "amber-700", bg: "butter" },
  { fg: "amber-700", bg: "surface-1" },
  { fg: "rose-700", bg: "blush" },
  { fg: "rose-700", bg: "surface-1" },
  // ink-200 borders are decorative dividers only. WCAG 1.4.11 (3:1) applies
  // to components that must be perceived to operate the UI; interactive
  // boundaries here are carried by teal-600 focus rings and deep-accent
  // borders, all of which are asserted above.
];
