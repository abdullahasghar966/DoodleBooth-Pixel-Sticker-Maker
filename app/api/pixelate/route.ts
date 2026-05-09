// /api/pixelate — Edge function. Receives a 96×96 face crop (base64 JPEG),
// calls Claude Vision, validates the response shape, returns pixel data.
//
// Privacy: the image is NEVER persisted. No logging of the image bytes.
// Only the rate-limit counter is stored (per-IP, per-day, in Vercel KV).

import { NextResponse, type NextRequest } from "next/server";
import { callClaudePixelate } from "@/lib/anthropicClient";
import { checkRateLimit, RATE_LIMIT_DAILY } from "@/lib/rateLimit";
import { isPaletteName, PALETTES } from "@/lib/palettes";
import { isDoodleFilterType, type DoodleFilterType } from "@/lib/svgFilters";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 20 * 1024;

const VALID_EXPRESSIONS = [
  "happy",
  "cool",
  "surprised",
  "sleepy",
  "neutral",
] as const;
type Expression = (typeof VALID_EXPRESSIONS)[number];

type Pos = { x: number; y: number };

export type PixelateSuccess = {
  pixels: number[][];
  landmarks: {
    eye_left: Pos;
    eye_right: Pos;
    nose: Pos;
    mouth: Pos;
  };
  expression: Expression;
  overlay: DoodleFilterType;
  confidence: number;
};

export type PixelateFallback = { error: true; fallback: true };

function isPos(v: unknown): v is Pos {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.x === "number" && typeof o.y === "number";
}

function isExpression(v: unknown): v is Expression {
  return (
    typeof v === "string" &&
    (VALID_EXPRESSIONS as readonly string[]).includes(v)
  );
}

function validatePixelateResponse(
  v: unknown,
  paletteSize: number,
): PixelateSuccess | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;

  if (!Array.isArray(o.pixels) || o.pixels.length !== 64) return null;
  for (const row of o.pixels) {
    if (!Array.isArray(row) || row.length !== 64) return null;
    for (const idx of row) {
      if (
        typeof idx !== "number" ||
        !Number.isInteger(idx) ||
        idx < 0 ||
        idx >= paletteSize
      ) {
        return null;
      }
    }
  }

  const lm = o.landmarks as Record<string, unknown> | undefined;
  if (
    !lm ||
    !isPos(lm.eye_left) ||
    !isPos(lm.eye_right) ||
    !isPos(lm.nose) ||
    !isPos(lm.mouth)
  ) {
    return null;
  }

  if (!isExpression(o.expression)) return null;
  if (!isDoodleFilterType(o.overlay)) return null;

  if (
    typeof o.confidence !== "number" ||
    o.confidence < 0 ||
    o.confidence > 1
  ) {
    return null;
  }

  return {
    pixels: o.pixels as number[][],
    landmarks: {
      eye_left: lm.eye_left,
      eye_right: lm.eye_right,
      nose: lm.nose,
      mouth: lm.mouth,
    },
    expression: o.expression,
    overlay: o.overlay,
    confidence: o.confidence,
  };
}

function stripCodeFences(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function tryParseJson(s: string): unknown {
  try {
    return JSON.parse(stripCodeFences(s));
  } catch {
    return null;
  }
}

function ipFromRequest(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

// Procedural face on a 64×64 grid. Palette indices (works for all 6 packs):
//   0=accent A (skin), 1=accent B (cheeks), 2=ink (outline / eyes / mouth),
//   3=lightest (eye whites), 4=mid (skin shadow), 5=dark mid (hair shadow),
//   6=dark (hair), 7=lightest (background).
// `seed` controls per-shot variation (head tilt, hair tone, expression, overlay)
// so the 4 mock stickers in a session don't all look identical.
function mockSuccess(seed = 0): PixelateSuccess {
  const W = 64;
  const H = 64;
  const pixels: number[][] = Array.from({ length: H }, () =>
    new Array<number>(W).fill(7),
  );

  const setPx = (x: number, y: number, v: number) => {
    if (x >= 0 && y >= 0 && x < W && y < H) pixels[y]![x] = v;
  };
  const fillCircle = (cx: number, cy: number, r: number, v: number) => {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r) setPx(cx + x, cy + y, v);
      }
    }
  };

  const tilt = (seed % 5) - 2;
  const hairTone = seed & 1 ? 5 : 6;
  const expressionIdx = seed % 5;
  const overlayIdx = seed % 4;

  const cx = 32;
  const cy = 36;
  const faceRX = 20;
  const faceRY = 23;

  // Face oval (skin)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / faceRX;
      const dy = (y - cy) / faceRY;
      if (dx * dx + dy * dy <= 1) pixels[y]![x] = 0;
    }
  }
  // Skin shadow on the right
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (pixels[y]![x] !== 0) continue;
      const dx = (x - cx) / faceRX;
      const dy = (y - cy) / faceRY;
      if (dx > 0.4 && dx * dx + dy * dy > 0.6) pixels[y]![x] = 4;
    }
  }
  // Hair on top
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / (faceRX + 2);
      const dy = (y - 22) / (faceRY + 4);
      if (dx * dx + dy * dy <= 1 && y < cy - 2) pixels[y]![x] = hairTone;
    }
  }
  // Side hair tufts
  for (let y = cy - 6; y < cy + 8; y++) {
    for (let x = 8; x < 14; x++) {
      const dx = (x - 11) / 4;
      const dy = (y - cy) / 10;
      if (dx * dx + dy * dy <= 1) pixels[y]![x] = hairTone;
    }
    for (let x = 50; x < 56; x++) {
      const dx = (x - 53) / 4;
      const dy = (y - cy) / 10;
      if (dx * dx + dy * dy <= 1) pixels[y]![x] = hairTone;
    }
  }

  const eyeY = 32 + tilt;
  const mouthY = 46;

  // Eyes + cheeks (default, may be overridden by expression)
  fillCircle(22, eyeY, 2, 3);
  fillCircle(42, eyeY, 2, 3);
  fillCircle(22, eyeY, 1, 2);
  fillCircle(42, eyeY, 1, 2);
  fillCircle(19, 41, 1, 1);
  fillCircle(45, 41, 1, 1);

  if (expressionIdx === 0) {
    // happy — slight smile
    for (let i = -4; i <= 4; i++) {
      const yOff = Math.floor(Math.abs(i) * 0.4);
      setPx(32 + i, mouthY + yOff, 2);
    }
  } else if (expressionIdx === 1) {
    // cool — sunglasses + flat mouth
    fillCircle(22, eyeY, 3, 2);
    fillCircle(42, eyeY, 3, 2);
    for (let i = 26; i <= 38; i++) setPx(i, eyeY, 2);
    for (let i = -4; i <= 4; i++) setPx(32 + i, mouthY, 2);
  } else if (expressionIdx === 2) {
    // surprised — O mouth
    fillCircle(32, mouthY + 1, 2, 2);
    setPx(32, mouthY + 1, 3);
  } else if (expressionIdx === 3) {
    // sleepy — closed eyes, small mouth
    fillCircle(22, eyeY, 2, 0);
    fillCircle(42, eyeY, 2, 0);
    for (let i = -2; i <= 2; i++) setPx(22 + i, eyeY, 2);
    for (let i = -2; i <= 2; i++) setPx(42 + i, eyeY, 2);
    for (let i = -1; i <= 1; i++) setPx(32 + i, mouthY, 2);
  } else {
    // neutral
    for (let i = -2; i <= 2; i++) setPx(32 + i, mouthY, 2);
  }

  // 1-px ink outline around the silhouette
  const original = pixels.map((r) => [...r]);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (original[y]![x] !== 7) continue;
      const hasNbr =
        (x > 0 && original[y]![x - 1] !== 7) ||
        (x < W - 1 && original[y]![x + 1] !== 7) ||
        (y > 0 && original[y - 1]![x] !== 7) ||
        (y < H - 1 && original[y + 1]![x] !== 7);
      if (hasNbr) pixels[y]![x] = 2;
    }
  }

  const expressions = [
    "happy",
    "cool",
    "surprised",
    "sleepy",
    "neutral",
  ] as const;
  const overlays = [
    "wiggle_border",
    "crosshatch",
    "star_burst",
    "none",
  ] as const;

  return {
    pixels,
    landmarks: {
      eye_left: { x: 22, y: eyeY },
      eye_right: { x: 42, y: eyeY },
      nose: { x: 32, y: 38 },
      mouth: { x: 32, y: mouthY },
    },
    expression: expressions[expressionIdx]!,
    overlay: overlays[overlayIdx]!,
    confidence: 0.99,
  };
}

export async function POST(req: NextRequest) {
  // Body parse — needed both in mock mode (for seed) and real mode.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    if (process.env.NEXT_PUBLIC_MOCK_CLAUDE === "true") {
      // Mock mode tolerates a missing body — just use seed 0.
      return NextResponse.json(mockSuccess(0));
    }
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Mock mode short-circuit — no API call, no rate-limit accounting.
  // Seed the mock from the request payload so the 4 shots in a session
  // produce 4 visually distinct stickers.
  if (process.env.NEXT_PUBLIC_MOCK_CLAUDE === "true") {
    const ib = (body as { imageBase64?: unknown })?.imageBase64;
    const seed = typeof ib === "string" ? ib.length : 0;
    return NextResponse.json(mockSuccess(seed));
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { imageBase64, palette, mode } = body as {
    imageBase64?: unknown;
    palette?: unknown;
    mode?: unknown;
  };

  if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
    return NextResponse.json(
      { error: "imageBase64_required" },
      { status: 400 },
    );
  }
  if (typeof palette !== "string" || !isPaletteName(palette)) {
    return NextResponse.json({ error: "invalid_palette" }, { status: 400 });
  }
  if (typeof mode !== "string") {
    return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
  }

  // Image size guard (≤ 20KB). base64 length × 3/4 ≈ raw byte count.
  const approxBytes = Math.floor((imageBase64.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "image_too_large", maxBytes: MAX_IMAGE_BYTES },
      { status: 400 },
    );
  }

  // Per-IP daily rate limit
  const ip = ipFromRequest(req);
  const rl = await checkRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", limit: RATE_LIMIT_DAILY, used: rl.used },
      { status: 429 },
    );
  }

  // Call Claude with one retry on parse failure (per spec).
  const paletteHex = PALETTES[palette];
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: string;
    try {
      raw = await callClaudePixelate({
        imageBase64,
        paletteName: palette,
        paletteHex,
        mode,
      });
    } catch {
      // Transport / API hard failure — no retry. Return fallback signal.
      return NextResponse.json(
        { error: true, fallback: true } satisfies PixelateFallback,
        { status: 502 },
      );
    }

    const parsed = tryParseJson(raw);
    const validated = validatePixelateResponse(parsed, paletteHex.length);
    if (validated) {
      return NextResponse.json(validated);
    }
    // else fall through and retry once
  }

  // Both attempts produced unparseable / invalid JSON.
  return NextResponse.json(
    { error: true, fallback: true } satisfies PixelateFallback,
  );
}
