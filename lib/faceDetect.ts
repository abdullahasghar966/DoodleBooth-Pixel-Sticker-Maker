"use client";

// MediaPipe FaceMesh wrapper + face-crop helper.
//
// - Lazy singleton — the WASM blob (~3 MB) is loaded once on first detection.
// - locateFile points at jsdelivr; no setup required, no user data leaves the
//   browser (only the public WASM/JS assets are fetched).
// - cropToBase64Jpeg returns the raw base64 (no `data:` prefix) so it can be
//   passed straight to /api/pixelate.

import { FaceMesh, type Results } from "@mediapipe/face_mesh";

export type FaceBox = { x0: number; y0: number; x1: number; y1: number };

// Used when MediaPipe fails to find a face — central 60% of the frame.
export const CENTER_FALLBACK_BOX: FaceBox = {
  x0: 0.2,
  y0: 0.2,
  x1: 0.8,
  y1: 0.8,
};

export type DetectSource =
  | HTMLVideoElement
  | HTMLImageElement
  | HTMLCanvasElement;

let cachedMesh: FaceMesh | null = null;
let latestResults: Results | null = null;

function getMesh(): FaceMesh {
  if (cachedMesh) return cachedMesh;
  const mesh = new FaceMesh({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });
  mesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  mesh.onResults((r) => {
    latestResults = r;
  });
  cachedMesh = mesh;
  return mesh;
}

export async function detectFaceBox(
  source: DetectSource,
): Promise<FaceBox | null> {
  const mesh = getMesh();
  latestResults = null;
  await mesh.send({ image: source });
  // Re-widen: TS narrowed `latestResults` to `null` after the assignment
  // above because it can't see the onResults callback updating it during
  // the await. The cast forces it back to the declared union.
  const captured = latestResults as Results | null;
  const landmarks = captured?.multiFaceLandmarks?.[0];
  if (!landmarks || landmarks.length === 0) return null;

  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const lm of landmarks) {
    if (lm.x < minX) minX = lm.x;
    if (lm.y < minY) minY = lm.y;
    if (lm.x > maxX) maxX = lm.x;
    if (lm.y > maxY) maxY = lm.y;
  }
  return { x0: minX, y0: minY, x1: maxX, y1: maxY };
}

function sourceDimensions(source: DetectSource): { w: number; h: number } {
  if (source instanceof HTMLVideoElement) {
    return { w: source.videoWidth, h: source.videoHeight };
  }
  if (source instanceof HTMLCanvasElement) {
    return { w: source.width, h: source.height };
  }
  // HTMLImageElement
  return { w: source.naturalWidth, h: source.naturalHeight };
}

function approxBase64Bytes(b64: string): number {
  return Math.floor((b64.length * 3) / 4);
}

const MAX_BYTES = 20 * 1024;

/**
 * Crops a square region (face box, expanded by `expand`) from `source`,
 * draws it into a 96×96 (or other) hidden canvas, returns base64 JPEG
 * payload (no `data:` prefix). Quality is auto-downgraded if needed to
 * stay under 20 KB.
 */
export function cropToBase64Jpeg(
  source: DetectSource,
  box: FaceBox,
  outSize = 96,
  expand = 0.25,
): string {
  const { w: sw, h: sh } = sourceDimensions(source);
  if (sw === 0 || sh === 0) {
    throw new Error("Source has zero dimensions");
  }

  const boxW = (box.x1 - box.x0) * sw;
  const boxH = (box.y1 - box.y0) * sh;
  const cx = ((box.x0 + box.x1) / 2) * sw;
  const cy = ((box.y0 + box.y1) / 2) * sh;
  const side = Math.max(boxW, boxH) * (1 + expand);

  let sx = Math.round(cx - side / 2);
  let sy = Math.round(cy - side / 2);
  let sSide = Math.round(side);
  // Clamp to source bounds.
  if (sx < 0) {
    sSide += sx;
    sx = 0;
  }
  if (sy < 0) {
    sSide += sy;
    sy = 0;
  }
  if (sx + sSide > sw) sSide = sw - sx;
  if (sy + sSide > sh) sSide = sh - sy;
  if (sSide <= 0) {
    // Degenerate box — fall back to a centered square.
    const fallback = Math.min(sw, sh);
    sx = Math.floor((sw - fallback) / 2);
    sy = Math.floor((sh - fallback) / 2);
    sSide = fallback;
  }

  const canvas = document.createElement("canvas");
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(source, sx, sy, sSide, sSide, 0, 0, outSize, outSize);

  // Strip the "data:image/jpeg;base64," prefix.
  const toRawB64 = (dataUrl: string) => {
    const i = dataUrl.indexOf(",");
    return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
  };

  let q = 0.85;
  let raw = toRawB64(canvas.toDataURL("image/jpeg", q));
  while (approxBase64Bytes(raw) > MAX_BYTES && q > 0.4) {
    q -= 0.1;
    raw = toRawB64(canvas.toDataURL("image/jpeg", q));
  }
  return raw;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}
