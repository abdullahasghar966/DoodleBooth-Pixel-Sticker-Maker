// Six fixed palette packs (per CLAUDE.md). Single source of truth — used by the
// edge function (resolves a palette name to hex colors before calling Claude),
// the canvas renderer, and the palette selector UI.

export type PaletteName =
  | "Banana Cream"
  | "Hot Pink"
  | "Retro Teal"
  | "Gameboy"
  | "Noir"
  | "Grape Crush";

export const PALETTES: Record<PaletteName, readonly string[]> = {
  "Banana Cream": [
    "#ffd166", "#ff8c42", "#1a1a1a", "#fffef8",
    "#e8c84e", "#c4a430", "#7a5c00", "#f0e8cc",
  ],
  "Hot Pink": [
    "#ff6b9d", "#b57bee", "#1a1a1a", "#fff0f6",
    "#e0409a", "#9b3bcb", "#5c0044", "#ffe0f0",
  ],
  "Retro Teal": [
    "#4ecdc4", "#06d6a0", "#1a1a2e", "#e0fff8",
    "#2aada4", "#00b882", "#004040", "#a0fff0",
  ],
  "Gameboy": [
    "#9bbc0f", "#8bac0f", "#306230", "#0f380f",
    "#c4d830", "#588018", "#1c4000", "#e0f8d0",
  ],
  "Noir": [
    "#f0f0f0", "#cccccc", "#888888", "#444444",
    "#1a1a1a", "#000000", "#ffffff", "#aaaaaa",
  ],
  "Grape Crush": [
    "#b57bee", "#7c3aed", "#2e1065", "#faf0ff",
    "#d4a0ff", "#9b30f0", "#4a0090", "#e8d0ff",
  ],
};

export const PALETTE_NAMES = Object.keys(PALETTES) as PaletteName[];

export const DEFAULT_PALETTE: PaletteName = "Banana Cream";

export function isPaletteName(s: unknown): s is PaletteName {
  return typeof s === "string" && (PALETTE_NAMES as string[]).includes(s);
}

export function getPalette(name: PaletteName): readonly string[] {
  return PALETTES[name];
}
