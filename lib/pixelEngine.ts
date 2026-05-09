// Pixel engine: Bayer 4×4 ordered dithering against a fixed palette.
// Pure functions — no DOM, no React. Used both client-side (preview, mock mode)
// and inside the Jest test for STEP 1.

export type PixelGrid = {
  pixels: number[][];
  width: number;
  height: number;
};

export const BAYER_4X4: readonly (readonly number[])[] = [
  [ 0,  8,  2, 10],
  [12,  4, 14,  6],
  [ 3, 11,  1,  9],
  [15,  7, 13,  5],
] as const;

const DITHER_STRENGTH = 32;

type RGB = readonly [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (v.length !== 6 || /[^0-9a-f]/i.test(v)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const n = parseInt(v, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

function nearestPaletteIndex(
  r: number,
  g: number,
  b: number,
  palette: readonly RGB[],
): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = palette[i];
    const dr = pr - r;
    const dg = pg - g;
    const db = pb - b;
    const d = dr * dr + dg * dg + db * db;
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function ditherImage(
  imageData: ImageData,
  palette: string[],
  gridSize: 64 | 32 | 16,
): PixelGrid {
  if (palette.length === 0) {
    throw new Error("Palette must contain at least one color");
  }
  if (palette.length > 8) {
    throw new Error("Palette must contain at most 8 colors");
  }
  if (imageData.width <= 0 || imageData.height <= 0) {
    throw new Error("ImageData must have positive dimensions");
  }

  const paletteRgb: RGB[] = palette.map(hexToRgb);
  const sx = imageData.width / gridSize;
  const sy = imageData.height / gridSize;
  const pixels: number[][] = [];

  for (let y = 0; y < gridSize; y++) {
    const row: number[] = [];
    const srcY = Math.min(
      Math.floor((y + 0.5) * sy),
      imageData.height - 1,
    );
    for (let x = 0; x < gridSize; x++) {
      const srcX = Math.min(
        Math.floor((x + 0.5) * sx),
        imageData.width - 1,
      );
      const i = (srcY * imageData.width + srcX) * 4;
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];

      // Bayer threshold normalized to (-0.5, +0.5), scaled by DITHER_STRENGTH.
      const threshold = (BAYER_4X4[y & 3][x & 3] + 1) / 17 - 0.5;
      const offset = threshold * DITHER_STRENGTH;

      row.push(
        nearestPaletteIndex(
          clamp(r + offset, 0, 255),
          clamp(g + offset, 0, 255),
          clamp(b + offset, 0, 255),
          paletteRgb,
        ),
      );
    }
    pixels.push(row);
  }

  return { pixels, width: gridSize, height: gridSize };
}
