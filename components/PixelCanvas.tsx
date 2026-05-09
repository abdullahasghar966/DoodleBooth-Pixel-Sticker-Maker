"use client";

// PixelCanvas — renders a PixelGrid to a 512×512 (default) canvas, with the
// chosen doodle SVG filter applied via CSS `filter: url(#…)`. Exposes an
// imperative handle (`exportPNG`, `copyToClipboard`) for STEP 6.
//
// Rendering pipeline:
//   1. Pixels are written into a native-size (gridSize × gridSize) OffscreenCanvas
//      via createImageData + putImageData.
//   2. That offscreen is drawn into the visible canvas with imageSmoothingEnabled
//      = false, scaling each source pixel to (size / gridSize) screen pixels.
//   3. The visible canvas wears `filter: url(#pixel-filter-<type>)`. The matching
//      <DoodleFilter> is mounted in a sibling 0×0 inline SVG so both live in the
//      same document and the URL fragment resolves.
//
// Export pipeline (`exportPNG`):
//   1. Re-render the pixels to a fresh OffscreenCanvas (no filter).
//   2. Convert that to a data URL, embed inside an inline <svg><image filter=…/>.
//   3. Rasterize the SVG via new Image() + drawImage onto a third OffscreenCanvas.
//   4. convertToBlob → PNG.
// This bakes the SVG filter into the output PNG (CSS filters don't transfer
// through canvas reads).

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { hexToRgb, type PixelGrid } from "@/lib/pixelEngine";
import {
  DoodleFilter,
  isDoodleFilterType,
  svgFilterString,
  type DoodleFilterType,
} from "@/lib/svgFilters";

const SVG_NS = "http://www.w3.org/2000/svg";

export type PixelCanvasHandle = {
  exportPNG(): Promise<Blob>;
  copyToClipboard(): Promise<void>;
};

export type PixelCanvasProps = {
  pixelGrid: PixelGrid;
  palette: string[];
  overlayType: string;
  gridSize: number;
  /** Display size in CSS pixels. Defaults to 512. */
  size?: number;
  className?: string;
};

type Ctx2D =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

function drawPixelGridToCtx(
  ctx: Ctx2D,
  grid: PixelGrid,
  palette: string[],
  gridSize: number,
  size: number,
): void {
  if (palette.length === 0 || gridSize <= 0) return;

  const off = new OffscreenCanvas(gridSize, gridSize);
  const offCtx = off.getContext("2d");
  if (!offCtx) throw new Error("OffscreenCanvas 2D context unavailable");

  const imgData = offCtx.createImageData(gridSize, gridSize);
  for (let y = 0; y < gridSize; y++) {
    const row = grid.pixels[y];
    for (let x = 0; x < gridSize; x++) {
      const rawIdx = row?.[x] ?? 0;
      const idx = Math.min(Math.max(rawIdx, 0), palette.length - 1);
      const [r, g, b] = hexToRgb(palette[idx]!);
      const o = (y * gridSize + x) * 4;
      imgData.data[o] = r;
      imgData.data[o + 1] = g;
      imgData.data[o + 2] = b;
      imgData.data[o + 3] = 255;
    }
  }
  offCtx.putImageData(imgData, 0, 0);

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(off, 0, 0, gridSize, gridSize, 0, 0, size, size);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export const PixelCanvas = forwardRef<PixelCanvasHandle, PixelCanvasProps>(
  function PixelCanvas(
    { pixelGrid, palette, overlayType, gridSize, size = 512, className },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const safeType: DoodleFilterType = isDoodleFilterType(overlayType)
      ? overlayType
      : "none";
    const filterId = useMemo(
      () => `pixel-filter-${safeType}`,
      [safeType],
    );

    // Re-draw whenever any rendering input changes.
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      drawPixelGridToCtx(ctx, pixelGrid, palette, gridSize, size);
    }, [pixelGrid, palette, gridSize, size]);

    useImperativeHandle(
      ref,
      () => {
        const exportPNG = async (): Promise<Blob> => {
          // Stage 1: clean pixel render at full size on an OffscreenCanvas.
          const base = new OffscreenCanvas(size, size);
          const baseCtx = base.getContext("2d");
          if (!baseCtx) {
            throw new Error("OffscreenCanvas 2D context unavailable");
          }
          drawPixelGridToCtx(baseCtx, pixelGrid, palette, gridSize, size);
          const baseBlob = await base.convertToBlob({ type: "image/png" });
          const baseDataUrl = await blobToDataUrl(baseBlob);

          // Stage 2: SVG with filter referencing the base image.
          const filterMarkup = svgFilterString("export-filter", safeType);
          const svgString =
            `<svg xmlns="${SVG_NS}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
            `<defs>${filterMarkup}</defs>` +
            `<image href="${baseDataUrl}" width="${size}" height="${size}" filter="url(#export-filter)"/>` +
            `</svg>`;

          // Stage 3: rasterize via Image + drawImage onto a fresh OffscreenCanvas.
          const svgBlob = new Blob([svgString], {
            type: "image/svg+xml;charset=utf-8",
          });
          const svgUrl = URL.createObjectURL(svgBlob);
          try {
            const img = await loadImage(svgUrl);
            const out = new OffscreenCanvas(size, size);
            const outCtx = out.getContext("2d");
            if (!outCtx) {
              throw new Error("OffscreenCanvas 2D context unavailable");
            }
            outCtx.drawImage(img, 0, 0);
            return await out.convertToBlob({ type: "image/png" });
          } finally {
            URL.revokeObjectURL(svgUrl);
          }
        };

        const copyToClipboard = async (): Promise<void> => {
          if (typeof ClipboardItem === "undefined") {
            throw new Error(
              "Clipboard API (ClipboardItem) not supported in this browser",
            );
          }
          const blob = await exportPNG();
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
        };

        return { exportPNG, copyToClipboard };
      },
      [pixelGrid, palette, gridSize, size, safeType],
    );

    return (
      <div
        className={className}
        style={{
          position: "relative",
          width: size,
          height: size,
          display: "inline-block",
        }}
      >
        {/* Inline 0×0 SVG defines the filter referenced by the canvas's CSS. */}
        <svg
          width={0}
          height={0}
          aria-hidden="true"
          style={{ position: "absolute", width: 0, height: 0 }}
        >
          <DoodleFilter id={filterId} type={safeType} />
        </svg>
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          style={{
            display: "block",
            width: size,
            height: size,
            imageRendering: "pixelated",
            filter: `url(#${filterId})`,
          }}
        />
      </div>
    );
  },
);
