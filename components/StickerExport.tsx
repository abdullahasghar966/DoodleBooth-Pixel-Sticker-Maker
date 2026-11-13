"use client";

import {
  useCallback,
  useEffect,
  useState,
  type RefObject,
} from "react";
import { saveAs } from "file-saver";
import type { PixelCanvasHandle } from "./PixelCanvas";
import type { PaletteName } from "@/lib/palettes";
import { DoodleAlert } from "./DoodleAlert";

const STRIP_W = 384;
const STRIP_H = 1404;
const FRAME_SIZE = 320;
const FRAME_GUTTER = 20;
const STRIP_MARGIN = 32;
const PAPER = "#f7f4ed";
const INK = "#1a1a1a";

export type StickerExportProps = {
  refs: RefObject<PixelCanvasHandle>[];
  paletteName: PaletteName;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function composeStripBlob(
  refs: RefObject<PixelCanvasHandle>[],
): Promise<Blob> {
  const canvas = new OffscreenCanvas(STRIP_W, STRIP_H);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("OffscreenCanvas 2D context unavailable");

  // Paper background.
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, STRIP_W, STRIP_H);

  // Outer ink border.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, STRIP_W - 4, STRIP_H - 4);

  for (let i = 0; i < refs.length && i < 4; i++) {
    const handle = refs[i]?.current;
    if (!handle) continue;
    const blob = await handle.exportPNG();
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadImage(url);
      const x = STRIP_MARGIN;
      const y = STRIP_MARGIN + i * (FRAME_SIZE + FRAME_GUTTER);
      ctx.drawImage(img, x, y, FRAME_SIZE, FRAME_SIZE);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, FRAME_SIZE, FRAME_SIZE);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return canvas.convertToBlob({ type: "image/png" });
}

export function StickerExport({ refs, paletteName }: StickerExportProps) {
  const [working, setWorking] = useState<"strip" | "share" | "preview" | null>(
    null,
  );
  const [hint, setHint] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const safeName = paletteName.replace(/\s+/g, "-").toLowerCase();

  // Revoke preview URL on unmount or when it changes.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const togglePreview = useCallback(async () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }
    setWorking("preview");
    setHint(null);
    try {
      const blob = await composeStripBlob(refs);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch {
      setHint("Couldn't build the preview — try downloading individual stickers.");
    } finally {
      setWorking(null);
    }
  }, [previewUrl, refs]);

  const downloadStrip = useCallback(async () => {
    setWorking("strip");
    setHint(null);
    try {
      const blob = await composeStripBlob(refs);
      saveAs(blob, `doodlebooth-${safeName}-strip.png`);
    } catch {
      setHint("Couldn't build the strip — try downloading individual stickers.");
    } finally {
      setWorking(null);
    }
  }, [refs, safeName]);

  const sharePack = useCallback(async () => {
    setWorking("share");
    setHint(null);
    const text = "I just made a pixel sticker! #DoodleBooth";
    try {
      let stripFile: File | null = null;
      try {
        const blob = await composeStripBlob(refs);
        stripFile = new File([blob], `doodlebooth-${safeName}-strip.png`, {
          type: "image/png",
        });
      } catch {
        stripFile = null;
      }

      const shareData: ShareData = { title: "DoodleBooth", text };
      if (
        stripFile &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [stripFile] })
      ) {
        shareData.files = [stripFile];
      }

      if (typeof navigator.share === "function") {
        await navigator.share(shareData);
      } else if (
        typeof navigator.clipboard?.writeText === "function"
      ) {
        await navigator.clipboard.writeText(text);
        setHint("Share text copied to your clipboard.");
      } else {
        setHint("Share isn't supported in this browser.");
      }
    } catch {
      // user cancelled or share rejected — silent.
    } finally {
      setWorking(null);
    }
  }, [refs, safeName]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-3 flex-wrap justify-center">
        <button
          className="doodle-btn-primary"
          onClick={() => void downloadStrip()}
          disabled={working !== null}
        >
          {working === "strip" ? "Building strip…" : "Download 4-frame strip"}
        </button>
        <button
          className="doodle-btn-secondary"
          onClick={() => void togglePreview()}
          disabled={working !== null}
        >
          {previewUrl
            ? "Hide preview"
            : working === "preview"
              ? "Building preview…"
              : "Preview strip"}
        </button>
        <button
          className="doodle-btn-secondary"
          onClick={() => void sharePack()}
          disabled={working !== null}
        >
          {working === "share" ? "Sharing…" : "Share"}
        </button>
      </div>
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- client-generated object URL; next/image cannot optimise it
        <img
          src={previewUrl}
          alt="4-frame strip preview"
          style={{
            width: 140,
            border: "2.5px solid #1a1a1a",
            boxShadow: "4px 4px 0 #1a1a1a",
            borderRadius: 6,
            display: "block",
          }}
        />
      )}
      {hint && (
        <DoodleAlert tone="error" title="Hmm">
          {hint}
        </DoodleAlert>
      )}
    </div>
  );
}
