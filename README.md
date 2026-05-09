# DoodleBooth 🎞️

A Claude-powered pixel-art photobooth web app. Take 4 quick webcam shots → Claude Vision pixelates each one into an 8-bit doodle sticker → customize the palette, pick an overlay filter, and download.

Fast. Playful. Privacy-first — **photos never leave your device**.

---

## ✨ What it does

1. Open the booth, grant camera permission
2. A 3-2-1-✨ countdown fires, then 4 shots are captured at 2-second intervals (with a flash effect)
3. Each face is detected client-side via MediaPipe and cropped to 96×96
4. Crops are sent to a Vercel Edge function that calls **Claude Opus 4** (`claude-opus-4-5`) with vision
5. Claude returns a 64×64 palette-indexed pixel grid + facial landmarks + a suggested doodle overlay
6. The booth renders all 4 stickers on a 512×512 canvas, with one of 4 SVG filters applied
7. You can swap palettes (6 packs), change overlays per sticker, download individual PNGs, copy to clipboard, download all 4 as a vertical photobooth strip, or share via the native share sheet

If the API call fails or rate-limits, the booth falls back to **local Bayer 4×4 dithering** so you still get a sticker.

---

## 🛠 Tech stack

- **Next.js 14** (App Router) + **TypeScript strict mode**
- **Claude Opus 4** via `@anthropic-ai/sdk` on **Vercel Edge runtime**
- **@mediapipe/face_mesh** (WASM) for browser-side face detection
- **Canvas 2D** + **OffscreenCanvas** for pixel rendering — no canvas libraries
- **SVG filters** (feTurbulence, feDisplacementMap, feMorphology, etc.) for the doodle aesthetic
- **framer-motion** for countdown + flash animations
- **Tailwind CSS** + hand-crafted doodle components — no UI library
- **Vercel KV** (REST API via `fetch`, no SDK) for per-IP daily rate limiting
- **Jest** for the pixel-engine tests

No database. No auth. No server-side image storage.

---

## 📁 Project structure

```
.
├── app/
│   ├── page.tsx                  # Landing page
│   ├── layout.tsx                # Root layout (fonts, doodle filter defs)
│   ├── globals.css               # Graph-paper background, doodle button styles
│   ├── booth/page.tsx            # Main booth orchestrator (state machine)
│   └── api/pixelate/route.ts     # Edge function → Claude Vision
├── components/
│   ├── CameraView.tsx            # Webcam + countdown + face crop
│   ├── PixelCanvas.tsx           # Canvas renderer + filter export
│   ├── PaletteSelector.tsx       # 6 palette packs
│   ├── StickerExport.tsx         # Strip composer + share
│   ├── DoodleFilters.tsx         # SVG filter mount point
│   ├── DoodleAlert.tsx           # Hand-drawn alert/error UI
│   └── SegmentedProgress.tsx     # Blocky 8-bit progress bar
├── lib/
│   ├── pixelEngine.ts            # Bayer 4×4 dithering + palette quantization
│   ├── pixelEngine.test.ts       # Jest tests (10 passing)
│   ├── svgFilters.ts             # 4 doodle filters: wiggle / hatch / starburst / none
│   ├── faceDetect.ts             # MediaPipe wrapper + face crop → base64 JPEG
│   ├── anthropicClient.ts        # Claude Vision call wrapper
│   ├── rateLimit.ts              # Vercel KV REST + in-memory fallback
│   └── palettes.ts               # 6 fixed palette packs
├── mock-preview.html             # Standalone artifact: generic pixel face × 6 palettes × 4 filters
├── your-face-preview.html        # Standalone artifact: upload a photo, see it dithered locally
├── progress.md                   # Build log (per-step decisions, test results)
├── CLAUDE.md                     # Project context for Claude Code
└── jest.config.js
```

---

## 🚀 Run it locally

Prerequisites: Node 20+, npm.

```bash
npm install
cp .env.local.example .env.local      # see env section below
npm run dev                            # → http://localhost:3000
```

Open `http://localhost:3000/booth`.

> **Camera works only on HTTPS or `localhost`.** `npm run dev` serves localhost which the browser treats as a secure origin. Don't use the LAN IP — `getUserMedia` will refuse.

### Other commands

```bash
npm run build      # production build
npm start          # serve the prod build
npm test           # run pixel-engine Jest suite
```

---

## 🔑 Environment variables

```env
# Required for real Claude calls
ANTHROPIC_API_KEY=sk-ant-...

# Optional — Vercel KV for per-IP rate limiting (recommended in production)
KV_REST_API_URL=
KV_REST_API_TOKEN=

# UI dev mode — skip real API calls, return a procedural mock face
NEXT_PUBLIC_MOCK_CLAUDE=true
```

### Mock vs real Claude

- **Mock mode** (`NEXT_PUBLIC_MOCK_CLAUDE=true`) — no API key needed. `/api/pixelate` returns a procedurally-generated face with per-shot variation (head tilt, hair tone, expression, overlay all rotate). Use this for UI iteration.
- **Real mode** — set `ANTHROPIC_API_KEY=sk-ant-...`, set `NEXT_PUBLIC_MOCK_CLAUDE=false`, restart the dev server. Each session = 4 API calls. Each call to `claude-opus-4-5` is roughly $0.01–0.03 with vision input.

---

## 🔒 Privacy guarantees

- Webcam frames are **never** sent to any server at full resolution
- `/api/pixelate` only ever receives a **96×96 face crop** as base64 JPEG (≤ 20 KB)
- The edge function calls Claude, gets the pixel map, and **discards the image** — no logging, no storage, no persistence whatsoever
- No localStorage, no analytics, no tracking
- The badge "🔒 Your photos never leave your device" is shown throughout the booth flow

---

## 🎨 Design system

Every UI element follows the doodle aesthetic strictly:

- **Colors**: Ink `#1a1a1a`, Paper `#f7f4ed`, six accent colors (yellow, pink, teal, purple, orange, green)
- **Typography**: **Caveat 700** for headings/buttons, **Courier Prime 400** for body. No system fonts.
- **Background**: 28 px graph-paper grid via CSS gradient overlay
- **Cards**: 2.5 px ink border, flat 4 px ink shadow (never CSS blur), 6–8 px border radius
- **Buttons**: ink border + flat shadow + Caveat font + wiggle hover animation
- **Filters** (4): `wiggle_border` (feTurbulence + feDisplacementMap), `crosshatch` (perpendicular hatching), `star_burst` (yellow halo), `none` (identity)

---

## ✅ Build status

All 7 build steps complete. Type-check clean (`tsc --noEmit`). Production build clean (`next build`).

- [x] STEP 1 — Pixel engine + Bayer 4×4 dithering (10/10 Jest tests)
- [x] STEP 2 — SVG filter pipeline (4 doodle filters, single source of truth)
- [x] STEP 3 — Anthropic edge function (mock mode, retry-once, KV rate limit)
- [x] STEP 4 — Camera component (MediaPipe FaceMesh, drop-zone fallback)
- [x] STEP 5 — Pixel canvas renderer (`exportPNG` / `copyToClipboard`)
- [x] STEP 6 — Main booth page (state machine, parallel API calls, local fallback)
- [x] STEP 7 — UI polish (segmented progress, doodle alerts, fonts via `next/font`)

See `progress.md` for the full build log with per-step design decisions.

---

## 🖼 Standalone preview artifacts

Two self-contained HTML files at the project root — no dev server required, just open in a browser:

- **`mock-preview.html`** — a procedural sample face rendered in all 6 palettes × all 4 filters × 4 expressions. Shows what the booth produces in mock mode.
- **`your-face-preview.html`** — upload your own photo and see it dithered locally with the same Bayer algorithm the booth's local fallback uses. Photo never uploaded anywhere — 100% client-side.

---

## ⚠️ Production notes

- **Set `KV_REST_API_URL` + `KV_REST_API_TOKEN`** in production. Without them, the rate limiter falls back to an in-memory `Map` which is effectively useless on Edge runtime (each invocation may land on a fresh isolate).
- **MediaPipe loads from jsdelivr CDN** without Subresource Integrity. For a hardened build, self-host the WASM in `public/mediapipe/` and update `locateFile` in `lib/faceDetect.ts`.
- **No Content Security Policy** is set by default. Recommended for production: `script-src 'self' https://cdn.jsdelivr.net`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`.
- IP-based rate limiting trusts the `X-Forwarded-For` header, which is correct on Vercel. Different proxy setups may need different handling.
