# DoodleBooth — Build Progress

_Auto-updated by Claude Code after each meaningful action. The 5-hour usage limit cannot be hooked directly — instead this file is updated incrementally so it stays current at any interruption point._

## Step Status
- [x] Pre-flight: Project scaffolded + dependencies installed
- [x] STEP 1: Pixel engine + dithering (lib/pixelEngine.ts) — **10/10 tests pass, 0 TS errors**
- [x] STEP 2: SVG filter pipeline (lib/svgFilters.ts) — **0 TS errors, 4 filters wired**
- [x] STEP 3: Anthropic edge function (app/api/pixelate/route.ts) — **0 TS errors, mock mode wired, KV via REST**
- [x] STEP 4: Camera component (components/CameraView.tsx) — **0 TS errors, MediaPipe FaceMesh + drop-zone fallback**
- [x] STEP 5: Pixel canvas renderer (components/PixelCanvas.tsx) — **0 TS errors, exportPNG/copyToClipboard exposed**
- [x] STEP 6: Main booth page (app/booth/page.tsx) — **0 TS errors, `next build` passes (4 routes compiled)**
- [x] STEP 7: UI polish pass — **0 TS errors, 10/10 Jest, `next build` passes**

## ✅ Build complete — all 7 steps done

## Timeline
- 2026-05-09 — Project bootstrapped: Next.js 14.2 + TS strict + Tailwind 3.4 + Jest 29.
- 2026-05-09 — `npm install` complete (426 packages, exit 0).
- 2026-05-09 — STEP 1 complete: `lib/pixelEngine.ts` + `lib/pixelEngine.test.ts`. 10/10 Jest tests pass; `tsc --noEmit` clean.
- 2026-05-09 — STEP 2 complete: `lib/svgFilters.ts`. Exports `DoodleFilter`, `svgFilterString`, `isDoodleFilterType`, `DOODLE_FILTER_TYPES`. Filters: wiggle_border / crosshatch / star_burst / none. tsc clean.
- 2026-05-09 — STEP 3 complete: `app/api/pixelate/route.ts` (Edge runtime) + `lib/anthropicClient.ts` + `lib/rateLimit.ts` + `lib/palettes.ts`. Mock mode short-circuits the route; Claude path validates response shape, retries once on parse fail, returns `{ error: true, fallback: true }` thereafter. KV rate limiting uses Upstash-compatible REST API via fetch (no `@vercel/kv` dep); falls back to in-memory Map in dev. tsc clean.
- 2026-05-09 — STEP 4 complete: `lib/faceDetect.ts` + `components/CameraView.tsx`. MediaPipe FaceMesh wrapper (lazy singleton, jsdelivr CDN locateFile). Camera flow: idle → permission → preview (live face polling every 700ms) → countdown (3-2-1-✨, 700ms each) → 4 captures @ 2s intervals with flash. File-upload drop-zone fallback on permission denial. tsc clean.
- 2026-05-09 — STEP 5 complete: `components/PixelCanvas.tsx`. Renders 64×64 grid → 512×512 with `imageSmoothingEnabled=false`. `forwardRef` exposes `exportPNG()` and `copyToClipboard()`. PNG export bakes the SVG filter via SVG-data-URL → Image rasterization → OffscreenCanvas → toBlob. Exported `hexToRgb` from `lib/pixelEngine.ts` for shared use. tsc clean, all 10 STEP 1 tests still pass.
- 2026-05-09 — STEP 6 complete: `app/booth/page.tsx` + `components/PaletteSelector.tsx` + `components/StickerExport.tsx`. State machine (capture → review → pixelating → edit). Parallel `/api/pixelate` calls; per-shot fallback to local `ditherImage` when API fails. Per-sticker overlay picker, global palette selector. 4-frame strip composer + `navigator.share()` with file fallback. `app/page.tsx` updated with CTA. `next build` passes; 4 routes compiled (/, /booth, /_not-found, /api/pixelate edge).
- 2026-05-09 — Bugfix: camera preview stayed black after permission grant. Root cause: `requestCamera` set `srcObject` while the `<video>` element was in a different render branch (stage="requesting" doesn't render the video), so `videoRef.current` was null. Fix: moved srcObject attachment into a `useEffect` keyed on `stage`, plus added `autoPlay` to the video element.
- 2026-05-09 — STEP 7 complete: polish pass. New components: `DoodleFilters` (global filter mount in app/layout.tsx), `DoodleAlert` (sketch-style alert with wiggle filter), `SegmentedProgress` (8px-segment pixel bar). Booth page: PixelatingStage uses SegmentedProgress; EditStage shows DoodleAlert when any sticker fell back to local rendering; pill button border-radius fixed (999 → 4px) per design spec. StickerExport: live strip preview toggle + DoodleAlert for hints. Audit pass: no banned fonts, no blur shadows, no border-radius > 8px in source. `npm test` 10/10, `next build` exits 0.

## Decisions locked
- Project files at repo root (`D:\DoodleBooth Pixel Sticker Maker Project\`); package name `doodlebooth`.
- Bayer 4×4 ordered dithering; squared Euclidean RGB distance; dither strength 32.
- `ditherImage` downsamples by sampling source pixel at the *center* of each output cell, then applies Bayer-offset RGB → nearest palette index.
- Display scale: 8× (64-pixel grid → 512px canvas) for STEP 5.
- Hand-written configs (no `create-next-app`).
- `jest.config.js` (CommonJS) instead of `.ts` — avoids needing a `ts-node` dep.
- Jest `testEnvironment: "node"` for the pixel engine. Will switch tests to `jsdom` if/when component tests are added.

## Files created
- Configs: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `jest.config.js`, `.gitignore`, `.env.local.example`.
- App shell: `app/layout.tsx`, `app/globals.css`, `app/page.tsx` (placeholder).
- STEP 1: `lib/pixelEngine.ts`, `lib/pixelEngine.test.ts`.
- STEP 2: `lib/svgFilters.ts`.
- STEP 3: `lib/palettes.ts`, `lib/rateLimit.ts`, `lib/anthropicClient.ts`, `app/api/pixelate/route.ts`.
- STEP 4: `lib/faceDetect.ts`, `components/CameraView.tsx`.
- STEP 5: `components/PixelCanvas.tsx` (+ `hexToRgb` exported from `lib/pixelEngine.ts`).
- STEP 6: `app/booth/page.tsx`, `components/PaletteSelector.tsx`, `components/StickerExport.tsx`. Updated `app/page.tsx` (landing CTA) and `components/CameraView.tsx` (added `shotCount` prop for single-shot retakes).
- STEP 7: `components/DoodleFilters.tsx`, `components/DoodleAlert.tsx`, `components/SegmentedProgress.tsx`. Updated `app/layout.tsx` (mount global filters), `app/booth/page.tsx` (segmented progress + fallback alert + pill borderRadius fix), `components/StickerExport.tsx` (preview toggle + DoodleAlert hints).

## Test results
- `npx jest lib/pixelEngine.test.ts` → **10 passed, 0 failed** (5.5s)
  - BAYER_4X4 shape valid
  - Grid dimensions correct for gridSize ∈ {16, 32, 64}
  - Solid red image → all index 0
  - All output indices ∈ valid palette range
  - Left-red / right-blue input separates into two regions
  - 3-digit hex codes accepted
  - Empty palette throws
  - Palette > 8 throws
- `npx tsc --noEmit` → **exit 0** (no type errors)

## Open questions awaiting user input
- _none through STEP 3_
- Before any non-mock testing: set `ANTHROPIC_API_KEY` in `.env.local` (and unset `NEXT_PUBLIC_MOCK_CLAUDE` or set to `false`).
- KV creds optional for dev. In production set `KV_REST_API_URL` + `KV_REST_API_TOKEN`.

## STEP 7 design notes
- **Global filters** (`DoodleFilters`) mounted in root layout via a 0×0 SVG. Filter ids: `doodle-wiggle_border`, `doodle-crosshatch`, `doodle-star_burst`, `doodle-none`. Distinct from PixelCanvas's per-instance `pixel-filter-*` ids.
- **DoodleAlert** wraps content in a div with `filter: url(#doodle-wiggle_border)` for the hand-drawn sketch border. Text gets a subtle wobble too (≤ 4px feDisplacementMap) — readable but feels hand-drawn.
- **SegmentedProgress**: 20 fixed 8px-wide segments with 1px ink borders, 2px gaps, paper-tan empty / yellow filled. Replaces the smooth bar in PixelatingStage per spec ("blocky pixel-progress-bar filling left-to-right with 8px segments").
- **Pill button fix**: STEP 6 used `borderRadius: 999` for overlay pickers — violated CLAUDE.md's "NEVER use border-radius > 8px on buttons". Changed to 4px rectangles with proper ink shadows.
- **Strip preview**: StickerExport's "Preview strip" toggles a 140px-wide thumbnail of the composed strip blob. Re-uses `composeStripBlob` so the preview = the actual export.
- **Fallback visibility**: when any sticker fell back to local pixel-engine rendering (Claude unreachable / parse failure), EditStage shows a DoodleAlert at the top so the user knows the result isn't Claude's full output.
- **Audit results**: zero banned fonts in source (`Inter|Roboto|system-ui|Arial|Helvetica|sans-serif`), zero blur box-shadows, zero `border-radius > 8px` in source after the pill fix.

## STEP 6 design notes
- **Stages**: simple `useState<Stage>` enum (`capture | review | pixelating | edit`) + sibling slices (shots, stickers, paletteName, progress, retakeIndex). Avoided a giant useReducer — the slices stay focused and testable.
- **CameraView extension**: added `shotCount?: number` prop (default 4). The booth's "Retake shot N" remounts CameraView with `shotCount={1}` and stores the new shot at index N.
- **API call pattern**: `Promise.all` of 4 calls — parallel for latency. The progress bar increments as each promise resolves.
- **Per-shot fallback**: if `/api/pixelate` returns `{error: true, fallback: true}` or any non-2xx, the booth runs the local `ditherImage` on the captured base64 (decoded via `data:image/jpeg;base64,…` + canvas `getImageData`). Same `PixelGrid` shape — downstream code doesn't branch.
- **Palette is global**, overlay is per-sticker. Claude's `overlay` field becomes the initial value; user can swap per sticker via 4 pill buttons. Palette swap re-uses the same indices — index 0 of Banana Cream becomes index 0 of Hot Pink, no re-pixelation.
- **CameraView dynamic-loaded** with `dynamic({ ssr: false })` to keep `@mediapipe/face_mesh` (which touches browser globals at import) out of the server bundle. PixelCanvas is SSR-safe — direct import.
- **Strip composer** lives in `StickerExport.tsx`: 384×1404 OffscreenCanvas, 4 × 320px frames with 20px gutters, paper background (#f7f4ed), ink borders. Calls each canvas's `exportPNG()` (which bakes the filter), draws into the strip, exports PNG.
- **Share** uses `navigator.canShare({files})` feature detection: if files supported, attaches the strip PNG; otherwise text-only; otherwise clipboard fallback.

## STEP 5 design notes
- **Render pipeline**: write each palette-indexed pixel into a `gridSize × gridSize` OffscreenCanvas via `createImageData` + `putImageData`, then `drawImage` to the visible 512×512 canvas with `imageSmoothingEnabled = false`. Pixels stay crisp.
- **Filter wiring**: an inline 0×0 `<svg>` mounted next to the canvas hosts the filter via `<DoodleFilter>`. The visible canvas references it via CSS `filter: url(#pixel-filter-<type>)`. Both elements live in the same document, so the URL fragment resolves cross-browser.
- **Filter applies to the entire pixel canvas**, not a separate overlay layer. wiggle_border / crosshatch intentionally distort or texture the source — that's the doodle aesthetic. `none` is an identity filter so callers can wire `filter: url(...)` unconditionally.
- **Export pipeline (`exportPNG`)**:
  1. Re-render pixels to an `OffscreenCanvas` (no filter).
  2. `convertToBlob` → `FileReader` → embed as a `data:` URL inside an inline `<svg><image filter="url(#export-filter)">…</svg>`.
  3. `URL.createObjectURL(svgBlob)` → `new Image()` → `drawImage` onto a third OffscreenCanvas → `convertToBlob`.
  This bakes the filter into the PNG (CSS filters do not transfer through canvas reads).
- **`copyToClipboard`** uses the export pipeline + `navigator.clipboard.write([new ClipboardItem({...})])`. Throws a clear error if `ClipboardItem` is missing (older Firefox).
- **Imperative handle, not a callback**: STEP 6 will hold a `useRef<PixelCanvasHandle>` and call `exportPNG()` from a button click. Keeps the renderer's surface small.

## STEP 4 design notes
- **MediaPipe loading**: `locateFile` points at `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/`. WASM (~3MB) loads on first detection. Only public assets are fetched — no user data leaves the browser.
- **Live preview face polling**: every 700ms while `stage === 'preview'`. Drives the "Move closer! 👀" banner. Capture button is always enabled — banner is informational, not blocking.
- **Per-shot fallback**: if MediaPipe loses the face on a single capture frame, falls back to `CENTER_FALLBACK_BOX` (central 60% of frame). User never sees a stalled capture.
- **Crop pipeline**: `cropToBase64Jpeg` expands the face bbox by 25% for hair/jaw, draws to a 96×96 canvas, exports JPEG with quality auto-downgraded (0.85 → 0.4) until the result is ≤ 20KB. Returns raw base64 (no `data:` prefix) — matches what `/api/pixelate` validates.
- **Selfie convention**: video preview is mirrored via CSS `transform: scaleX(-1)`; the captured frame stays un-mirrored (drawImage reads the raw stream).
- **TS quirk**: had to cast `latestResults as Results | null` after `latestResults = null` because TS can't see the MediaPipe callback updating the variable during `await mesh.send()`. Without the cast, control-flow analysis narrows it to `never`.
- **File upload fallback**: drop-zone + file picker on camera-denied. Same crop pipeline (MediaPipe still runs on still images). Pads to 4 shots by repeating the last image if user uploads fewer.

## STEP 3 design notes
- Wire format: client sends `{ imageBase64, palette, mode }` where `palette` is the **palette name** (one of the six). Server resolves to hex via `lib/palettes.ts` before calling Claude. Saves ~150 bytes per request and locks consistency across the 6 packs.
- `mode` is forwarded into the user-text prompt as a hint. No enum check — the system prompt is the source of truth.
- Image size guard: rejects with HTTP 400 if `base64.length × 3/4 > 20480`. Cheap pre-check; we trust the client to send only the 96×96 face crop.
- Mock mode (`NEXT_PUBLIC_MOCK_CLAUDE=true`) short-circuits the entire route — no rate-limit ticking, no API key needed.
- Retry-once policy: if Claude's response fails JSON parse OR shape validation, retry once. After that, return `{ error: true, fallback: true }` so the client can render a deterministic fallback (e.g. via the local `ditherImage`).
- Transport-level errors (Anthropic 5xx, network) skip the retry and return the same fallback shape with HTTP 502.
- KV rate limiter uses Upstash-compatible REST endpoints (`/pipeline` POST with `[["INCR", key], ["EXPIRE", key, 86400]]`). Avoids the `@vercel/kv` SDK so we don't expand the package allowlist.
- Validator is hand-rolled (no `zod`). Checks: 64×64 integer matrix, indices in `[0, paletteSize)`, 4 landmarks with numeric x/y, expression in the allowed set, `overlay` matches `isDoodleFilterType()`, confidence in `[0, 1]`.

## STEP 2 design notes
- Single `FILTERS` data structure feeds both `svgFilterString()` and `<DoodleFilter>` so the string and JSX renderers can never drift.
- File kept as `.ts` (not `.tsx`) per spec; React tree built with `React.createElement` to avoid JSX in a `.ts` file.
- `<DoodleFilter>` returns `<defs><filter>…</filter></defs>` — caller wraps it in an `<svg width="0" height="0">` and references the filter via `filter: url(#id)`.
- `crosshatch` uses two perpendicular `feTurbulence` layers thresholded with `feColorMatrix` then composited inside the source.
- `star_burst` is a yellow halo via `feMorphology dilate` + `feGaussianBlur` + `feColorMatrix` + `feMerge`.
- `none` is an identity `feColorMatrix` so callers can wire `filter: url(#…)` unconditionally.

## How to resume
1. Open a terminal at `D:\DoodleBooth Pixel Sticker Maker Project`
2. If `node_modules` is missing: `npm install`
3. `npm test` — should show 10 passing tests
4. Read `## Step Status` above for next step (currently STEP 2)

## Privacy & hard rules (carried forward from CLAUDE.md)
- Webcam frames never sent to server at full resolution
- /api/pixelate sees only a 96×96 base64 JPEG ≤ 20KB
- No server-side image storage, no logging of image content
- No UI library — all components hand-crafted to the design system
