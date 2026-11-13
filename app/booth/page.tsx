"use client";

import {
  createRef,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { saveAs } from "file-saver";

import { PaletteSelector } from "@/components/PaletteSelector";
import { StickerExport } from "@/components/StickerExport";
import {
  PixelCanvas,
  type PixelCanvasHandle,
} from "@/components/PixelCanvas";
import { SegmentedProgress } from "@/components/SegmentedProgress";
import { DoodleAlert } from "@/components/DoodleAlert";
import {
  DEFAULT_PALETTE,
  PALETTES,
  type PaletteName,
} from "@/lib/palettes";
import { ditherImage, type PixelGrid } from "@/lib/pixelEngine";
import {
  DOODLE_FILTER_TYPES,
  isDoodleFilterType,
  type DoodleFilterType,
} from "@/lib/svgFilters";

// CameraView pulls in @mediapipe/face_mesh which touches `self`/browser
// globals at import time. ssr:false keeps it out of the server bundle.
const CameraView = dynamic(
  () => import("@/components/CameraView").then((m) => m.CameraView),
  { ssr: false, loading: () => <p className="font-courier text-center">Loading camera…</p> },
);

const SHOT_COUNT = 4;
const GRID_SIZE = 64;
const STICKER_SIZE = 320;

type Stage = "capture" | "review" | "pixelating" | "edit";

type StickerData = {
  pixels: number[][];
  overlay: DoodleFilterType;
  expression: string;
  confidence: number;
  usedFallback: boolean;
};

type PixelateApiSuccess = {
  pixels: number[][];
  landmarks: unknown;
  expression: string;
  overlay: string;
  confidence: number;
};

const PRETTY_OVERLAY: Record<DoodleFilterType, string> = {
  wiggle_border: "Wiggle",
  crosshatch: "Hatch",
  star_burst: "Sparkle",
  none: "Plain",
};

async function callPixelateApi(
  imageBase64: string,
  paletteName: PaletteName,
): Promise<PixelateApiSuccess | null> {
  try {
    const res = await fetch("/api/pixelate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64,
        palette: paletteName,
        mode: "normal",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<PixelateApiSuccess> & {
      error?: boolean;
      fallback?: boolean;
    };
    if (data.error || data.fallback) return null;
    if (!Array.isArray(data.pixels) || typeof data.overlay !== "string") {
      return null;
    }
    return data as PixelateApiSuccess;
  } catch {
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function localFallback(
  imageBase64: string,
  paletteHex: string[],
): Promise<PixelGrid> {
  const img = await loadImage(`data:image/jpeg;base64,${imageBase64}`);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || 96;
  canvas.height = img.naturalHeight || 96;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return ditherImage(data, paletteHex, 64);
}

function checkerboardGrid(): PixelGrid {
  const pixels: number[][] = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    const row: number[] = [];
    for (let x = 0; x < GRID_SIZE; x++) row.push((x + y) & 7);
    pixels.push(row);
  }
  return { pixels, width: GRID_SIZE, height: GRID_SIZE };
}

export default function BoothPage() {
  const [stage, setStage] = useState<Stage>("capture");
  const [shots, setShots] = useState<string[]>([]);
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null);
  const [stickers, setStickers] = useState<StickerData[]>([]);
  const [paletteName, setPaletteName] = useState<PaletteName>(DEFAULT_PALETTE);
  const [progress, setProgress] = useState(0);

  const palette = useMemo(
    () => [...PALETTES[paletteName]],
    [paletteName],
  );

  const canvasRefs = useRef<React.RefObject<PixelCanvasHandle>[]>(
    Array.from({ length: SHOT_COUNT }, () => createRef<PixelCanvasHandle>()),
  );

  // ───────── camera completion handler ─────────
  const handleCameraComplete = useCallback(
    async (newShots: string[]) => {
      if (retakeIndex !== null) {
        // Single-shot retake: replace just one entry.
        const replacement = newShots[0];
        if (replacement) {
          setShots((curr) => {
            const copy = [...curr];
            copy[retakeIndex] = replacement;
            return copy;
          });
        }
        setRetakeIndex(null);
        setStage("review");
        return;
      }
      // Full session
      const padded = [...newShots];
      while (padded.length < SHOT_COUNT && padded.length > 0) {
        padded.push(padded[padded.length - 1]!);
      }
      setShots(padded);
      setStage("review");
    },
    [retakeIndex],
  );

  // ───────── pixelate all 4 shots ─────────
  const startPixelating = useCallback(async () => {
    if (shots.length !== SHOT_COUNT) return;
    setStage("pixelating");
    setProgress(0);
    const paletteHex = [...PALETTES[paletteName]];

    let done = 0;
    const incrDone = () => {
      done += 1;
      setProgress(done);
    };

    const promises = shots.map(async (shot): Promise<StickerData> => {
      const api = await callPixelateApi(shot, paletteName);
      if (api) {
        incrDone();
        const overlay: DoodleFilterType = isDoodleFilterType(api.overlay)
          ? api.overlay
          : "none";
        return {
          pixels: api.pixels,
          overlay,
          expression: api.expression,
          confidence: api.confidence,
          usedFallback: false,
        };
      }
      // Local fallback path.
      try {
        const grid = await localFallback(shot, paletteHex);
        incrDone();
        return {
          pixels: grid.pixels,
          overlay: "none",
          expression: "neutral",
          confidence: 0.3,
          usedFallback: true,
        };
      } catch {
        incrDone();
        return {
          pixels: checkerboardGrid().pixels,
          overlay: "none",
          expression: "neutral",
          confidence: 0,
          usedFallback: true,
        };
      }
    });

    const results = await Promise.all(promises);
    setStickers(results);
    setStage("edit");
  }, [shots, paletteName]);

  // ───────── review actions ─────────
  const retakeAll = useCallback(() => {
    setShots([]);
    setStickers([]);
    setRetakeIndex(null);
    setStage("capture");
  }, []);

  const retakeSingle = useCallback((i: number) => {
    setRetakeIndex(i);
    setStage("capture");
  }, []);

  const setStickerOverlay = useCallback(
    (index: number, overlay: DoodleFilterType) => {
      setStickers((curr) =>
        curr.map((s, i) => (i === index ? { ...s, overlay } : s)),
      );
    },
    [],
  );

  const downloadOne = useCallback(
    async (index: number) => {
      const handle = canvasRefs.current[index]?.current;
      if (!handle) return;
      try {
        const blob = await handle.exportPNG();
        const safeName = paletteName.replace(/\s+/g, "-").toLowerCase();
        saveAs(blob, `doodlebooth-${safeName}-${index + 1}.png`);
      } catch {
        // ignore
      }
    },
    [paletteName],
  );

  const copyOne = useCallback(async (index: number) => {
    const handle = canvasRefs.current[index]?.current;
    if (!handle) return;
    try {
      await handle.copyToClipboard();
    } catch {
      // ignore
    }
  }, []);

  // ───────── render ─────────
  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-6">
          <h1
            style={{
              fontFamily: "var(--font-caveat), cursive",
              fontWeight: 700,
              fontSize: 56,
              marginBottom: 4,
            }}
          >
            DoodleBooth
          </h1>
          <p className="font-courier text-sm opacity-80">
            🔒 Your photos never leave your device.
          </p>
        </header>

        {stage === "capture" && (
          <CameraView
            onComplete={handleCameraComplete}
            shotCount={retakeIndex !== null ? 1 : SHOT_COUNT}
          />
        )}

        {stage === "review" && (
          <ReviewStage
            shots={shots}
            onConfirm={() => void startPixelating()}
            onRetakeAll={retakeAll}
            onRetakeOne={retakeSingle}
          />
        )}

        {stage === "pixelating" && (
          <PixelatingStage progress={progress} total={SHOT_COUNT} />
        )}

        {stage === "edit" && (
          <EditStage
            stickers={stickers}
            palette={palette}
            paletteName={paletteName}
            onPaletteChange={setPaletteName}
            onOverlayChange={setStickerOverlay}
            canvasRefs={canvasRefs.current}
            onDownloadOne={downloadOne}
            onCopyOne={copyOne}
            onStartOver={retakeAll}
          />
        )}
      </div>
    </main>
  );
}

// ───────── stage components ─────────

function ReviewStage({
  shots,
  onConfirm,
  onRetakeAll,
  onRetakeOne,
}: {
  shots: string[];
  onConfirm: () => void;
  onRetakeAll: () => void;
  onRetakeOne: (i: number) => void;
}) {
  return (
    <div className="doodle-card p-6 max-w-3xl mx-auto">
      <h2 className="text-3xl text-center mb-4">Looking good?</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {shots.map((shot, i) => (
          <div
            key={i}
            className="flex flex-col items-center"
            style={{
              border: "2.5px solid #1a1a1a",
              borderRadius: 6,
              padding: 6,
              background: "#fff",
              boxShadow: "3px 3px 0 #1a1a1a",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- in-memory camera snapshot (data URL); next/image cannot optimise it */}
            <img
              src={`data:image/jpeg;base64,${shot}`}
              alt={`Shot ${i + 1}`}
              style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }}
            />
            <button
              className="doodle-btn-secondary mt-2"
              style={{ padding: "4px 12px", fontSize: 14 }}
              onClick={() => onRetakeOne(i)}
            >
              Retake
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-3 justify-center flex-wrap">
        <button className="doodle-btn-primary" onClick={onConfirm}>
          Pixelate these!
        </button>
        <button className="doodle-btn-secondary" onClick={onRetakeAll}>
          Retake all
        </button>
      </div>
    </div>
  );
}

function PixelatingStage({
  progress,
  total,
}: {
  progress: number;
  total: number;
}) {
  return (
    <div className="doodle-card p-8 max-w-md mx-auto text-center">
      <h2 className="text-3xl mb-3">Pixelating…</h2>
      <p className="font-courier mb-4">
        {progress} of {total} stickers ready
      </p>
      <div className="flex justify-center">
        <SegmentedProgress progress={progress} total={total} segments={20} />
      </div>
    </div>
  );
}

function EditStage({
  stickers,
  palette,
  paletteName,
  onPaletteChange,
  onOverlayChange,
  canvasRefs,
  onDownloadOne,
  onCopyOne,
  onStartOver,
}: {
  stickers: StickerData[];
  palette: string[];
  paletteName: PaletteName;
  onPaletteChange: (name: PaletteName) => void;
  onOverlayChange: (index: number, overlay: DoodleFilterType) => void;
  canvasRefs: React.RefObject<PixelCanvasHandle>[];
  onDownloadOne: (i: number) => void;
  onCopyOne: (i: number) => void;
  onStartOver: () => void;
}) {
  const fallbackCount = stickers.filter((s) => s.usedFallback).length;
  return (
    <div className="space-y-6">
      {fallbackCount > 0 && (
        <div className="flex justify-center">
          <DoodleAlert tone="error" title="Fallback rendering used">
            {fallbackCount === stickers.length
              ? "We couldn't reach Claude — all stickers were rendered locally with the pixel engine. Try again later for the full effect."
              : `${fallbackCount} of ${stickers.length} stickers fell back to the local pixel engine.`}
          </DoodleAlert>
        </div>
      )}
      <section className="doodle-card p-4">
        <h2 className="text-2xl text-center mb-3">Pick a palette</h2>
        <PaletteSelector selected={paletteName} onSelect={onPaletteChange} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stickers.map((s, i) => (
          <div key={i} className="doodle-card p-4 flex flex-col items-center">
            <PixelCanvas
              ref={canvasRefs[i]}
              pixelGrid={{
                pixels: s.pixels,
                width: GRID_SIZE,
                height: GRID_SIZE,
              }}
              palette={palette}
              overlayType={s.overlay}
              gridSize={GRID_SIZE}
              size={STICKER_SIZE}
            />
            <div className="flex gap-2 flex-wrap justify-center mt-3">
              {DOODLE_FILTER_TYPES.map((t) => {
                const active = s.overlay === t;
                return (
                  <button
                    key={t}
                    onClick={() => onOverlayChange(i, t)}
                    style={{
                      padding: "4px 10px",
                      fontFamily: "var(--font-caveat), cursive",
                      fontWeight: 700,
                      fontSize: 14,
                      border: "2px solid #1a1a1a",
                      borderRadius: 4,
                      background: active ? "#1a1a1a" : "#fff",
                      color: active ? "#ffd166" : "#1a1a1a",
                      cursor: "pointer",
                      boxShadow: active ? "1px 1px 0 #555" : "2px 2px 0 #1a1a1a",
                    }}
                  >
                    {PRETTY_OVERLAY[t]}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 mt-3">
              <button
                className="doodle-btn-secondary"
                style={{ padding: "4px 10px", fontSize: 14 }}
                onClick={() => void onDownloadOne(i)}
              >
                Download
              </button>
              <button
                className="doodle-btn-secondary"
                style={{ padding: "4px 10px", fontSize: 14 }}
                onClick={() => void onCopyOne(i)}
              >
                Copy
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="doodle-card p-4">
        <StickerExport refs={canvasRefs} paletteName={paletteName} />
      </section>

      <div className="flex justify-center">
        <button className="doodle-btn-secondary" onClick={onStartOver}>
          Start over
        </button>
      </div>
    </div>
  );
}
