import { ditherImage, BAYER_4X4 } from "./pixelEngine";

function makeImageData(
  width: number,
  height: number,
  fill: (x: number, y: number) => [number, number, number],
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fill(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { data, width, height, colorSpace: "srgb" } as unknown as ImageData;
}

describe("BAYER_4X4", () => {
  it("is a 4x4 matrix containing every value 0..15 exactly once", () => {
    expect(BAYER_4X4.length).toBe(4);
    BAYER_4X4.forEach((row) => expect(row.length).toBe(4));
    const flat = BAYER_4X4.flat() as number[];
    expect([...flat].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 16 }, (_, i) => i),
    );
  });
});

describe("ditherImage", () => {
  const redBlackPalette = ["#ff0000", "#000000"];

  it.each([16, 32, 64] as const)(
    "returns a %ix%i grid for gridSize=%i",
    (gridSize) => {
      const img = makeImageData(10, 10, () => [255, 0, 0]);
      const result = ditherImage(img, redBlackPalette, gridSize);
      expect(result.width).toBe(gridSize);
      expect(result.height).toBe(gridSize);
      expect(result.pixels.length).toBe(gridSize);
      result.pixels.forEach((row) => expect(row.length).toBe(gridSize));
    },
  );

  it("maps a solid red 10x10 image to the red palette index", () => {
    const img = makeImageData(10, 10, () => [255, 0, 0]);
    const result = ditherImage(img, redBlackPalette, 16);
    result.pixels.forEach((row) => {
      row.forEach((idx) => expect(idx).toBe(0));
    });
  });

  it("produces only valid palette indices", () => {
    const img = makeImageData(10, 10, (x, y) => [
      (x * 25) % 256,
      (y * 25) % 256,
      128,
    ]);
    const palette4 = ["#ff0000", "#00ff00", "#0000ff", "#ffffff"];
    const result = ditherImage(img, palette4, 32);
    result.pixels.forEach((row) => {
      row.forEach((idx) => {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(palette4.length);
      });
    });
  });

  it("separates a left-red / right-blue 10x10 image into two regions", () => {
    const img = makeImageData(10, 10, (x) =>
      x < 5 ? [255, 0, 0] : [0, 0, 255],
    );
    const palette = ["#ff0000", "#0000ff"];
    const result = ditherImage(img, palette, 16);
    const leftSum = result.pixels.reduce(
      (s, row) => s + row.slice(0, 8).reduce((a, b) => a + b, 0),
      0,
    );
    const rightSum = result.pixels.reduce(
      (s, row) => s + row.slice(8).reduce((a, b) => a + b, 0),
      0,
    );
    // Left half should mostly be index 0 (red), right half mostly index 1 (blue).
    expect(leftSum).toBeLessThan(rightSum);
  });

  it("handles 3-digit hex codes in the palette", () => {
    const img = makeImageData(10, 10, () => [255, 255, 255]);
    const result = ditherImage(img, ["#fff", "#000"], 16);
    result.pixels.forEach((row) =>
      row.forEach((idx) => expect(idx).toBe(0)),
    );
  });

  it("throws on empty palette", () => {
    const img = makeImageData(10, 10, () => [128, 128, 128]);
    expect(() => ditherImage(img, [], 16)).toThrow();
  });

  it("throws on palette larger than 8 colors", () => {
    const img = makeImageData(10, 10, () => [128, 128, 128]);
    const tooMany = Array.from({ length: 9 }, () => "#000000");
    expect(() => ditherImage(img, tooMany, 16)).toThrow();
  });
});
