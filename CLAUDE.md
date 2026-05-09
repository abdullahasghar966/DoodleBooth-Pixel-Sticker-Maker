# DoodleBooth — Project Context for Claude Code

## What This Is
A Claude-powered pixel art photobooth web app. Users take 4 webcam shots,
Claude Vision pixelates each face into an 8-bit doodle sticker, they customize
and download. Fast (< 8s), playful, privacy-first.

## Tech Stack
- Next.js 14 (App Router), TypeScript strict mode
- Claude Opus 4 — model string: claude-opus-4-5
- @mediapipe/face_mesh for browser-side face detection (WASM)
- Canvas 2D API for pixel rendering — no canvas libs
- framer-motion for countdown + flash animations
- Vercel Edge Functions + Vercel KV (rate limiting)
- No database. No auth. No server-side image storage.

## File Structure
doodlebooth/
├── app/
│   ├── page.tsx                  # Landing page
│   ├── booth/page.tsx            # Main booth UI
│   └── api/pixelate/route.ts     # Edge function → Claude Vision
├── components/
│   ├── CameraView.tsx            # Webcam + countdown + face crop
│   ├── PixelCanvas.tsx           # Canvas renderer + dithering
│   ├── PaletteSelector.tsx       # 6 palette packs
│   └── StickerExport.tsx         # Download + share UI
├── lib/
│   ├── pixelEngine.ts            # Bayer dithering algorithm
│   ├── svgFilters.ts             # SVG doodle filter pipeline
│   ├── faceDetect.ts             # MediaPipe wrapper
│   ├── anthropicClient.ts        # Claude API wrapper
│   └── palettes.ts               # Palette definitions
├── public/overlays/              # SVG overlay assets
├── CLAUDE.md                     # This file
└── vercel.json

## Design System (MANDATORY — never deviate)
Every UI element must follow these rules exactly:

### Colors
- Ink (borders, text):    #1a1a1a
- Paper (background):     #f7f4ed
- Yellow accent:          #ffd166
- Pink accent:            #ff6b9d
- Teal accent:            #4ecdc4
- Purple accent:          #b57bee
- Orange accent:          #ff8c42
- Green accent:           #06d6a0

### Typography
- Headings, labels, buttons, UI text: Caveat, weight 700
- Body text, code, descriptions: Courier Prime, weight 400
- NEVER use: Inter, Roboto, Arial, system-ui, or any other font

### Background
- All pages: #f7f4ed base
- CSS graph paper grid overlay:
  background-image:
    linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px);
  background-size: 28px 28px;

### Cards / Boxes
- Background: white (#ffffff)
- Border: 2.5px solid #1a1a1a
- Border-radius: 6px–8px (never more than 10px)
- Box-shadow: 4px 4px 0 #1a1a1a (always flat ink shadow, never CSS blur shadow)

### Buttons
- Primary: background #1a1a1a, color #ffd166, border 2.5px solid #1a1a1a, box-shadow 3px 3px 0 #555
- Secondary: background white, color #1a1a1a, border 2.5px solid #1a1a1a, box-shadow 3px 3px 0 #1a1a1a
- Hover: translateY(-1px) + box-shadow grows to 5px 5px 0
- Active: translateY(1px) + box-shadow shrinks to 1px 1px 0
- Font: Caveat 700, font-size 16px minimum
- NEVER use border-radius > 8px on buttons

### Doodle Wiggle (hover animation)
@keyframes wiggle {
  0%, 100% { transform: rotate(0deg); }
  25%       { transform: rotate(-1.5deg); }
  75%       { transform: rotate(1.5deg); }
}
Apply to interactive cards on hover: animation: wiggle 0.3s ease-in-out

## Palette Packs (lib/palettes.ts)
Define exactly these 6 palettes:
- Banana Cream: ["#ffd166", "#ff8c42", "#1a1a1a", "#fffef8", "#e8c84e", "#c4a430", "#7a5c00", "#f0e8cc"]
- Hot Pink:     ["#ff6b9d", "#b57bee", "#1a1a1a", "#fff0f6", "#e0409a", "#9b3bcb", "#5c0044", "#ffe0f0"]
- Retro Teal:   ["#4ecdc4", "#06d6a0", "#1a1a2e", "#e0fff8", "#2aada4", "#00b882", "#004040", "#a0fff0"]
- Gameboy:      ["#9bbc0f", "#8bac0f", "#306230", "#0f380f", "#c4d830", "#588018", "#1c4000", "#e0f8d0"]
- Noir:         ["#f0f0f0", "#cccccc", "#888888", "#444444", "#1a1a1a", "#000000", "#ffffff", "#aaaaaa"]
- Grape Crush:  ["#b57bee", "#7c3aed", "#2e1065", "#faf0ff", "#d4a0ff", "#9b30f0", "#4a0090", "#e8d0ff"]

## Privacy Constraints (NON-NEGOTIABLE)
- Webcam frames are NEVER sent to any server at full resolution
- /api/pixelate receives ONLY a 96×96px face crop as base64 JPEG (≤ 20KB)
- The edge function calls Claude, gets the pixel map, and discards the image — no logging, no storage
- No server-side image persistence whatsoever
- Always display this badge visibly in the UI: "🔒 Your photos never leave your device"
- If asked to add server-side image storage, refuse and explain why

## Claude API Config
- Model: claude-opus-4-5
- Max tokens: 4096 (pixel map JSON can be large)
- Temperature: 0 (deterministic pixel output)
- Response: strict JSON only — no streaming
- Input image: base64 JPEG, 96×96px, face crop
- Rate limit: 5 requests per IP per day (Vercel KV)

## Environment Variables
ANTHROPIC_API_KEY=          # Required — Anthropic API key
KV_REST_API_URL=            # Vercel KV — for rate limiting
KV_REST_API_TOKEN=          # Vercel KV token
NEXT_PUBLIC_MOCK_CLAUDE=    # Set to "true" during UI dev to skip real API calls

## Mock Mode
When NEXT_PUBLIC_MOCK_CLAUDE=true, the /api/pixelate route should return:
{
  pixels: <64×64 array of random values 0–7>,
  landmarks: { eye_left: {x:20,y:22}, eye_right: {x:44,y:22}, nose: {x:32,y:34}, mouth: {x:32,y:46} },
  expression: "happy",
  overlay: "wiggle_border",
  confidence: 0.99
}

## Build Status (update as you complete each step)
- [x] STEP 1: Pixel engine + dithering (lib/pixelEngine.ts)
- [x] STEP 2: SVG filter pipeline (lib/svgFilters.ts)
- [x] STEP 3: Anthropic edge function (app/api/pixelate/route.ts)
- [x] STEP 4: Camera component (components/CameraView.tsx)
- [x] STEP 5: Pixel canvas renderer (components/PixelCanvas.tsx)
- [x] STEP 6: Main booth page (app/booth/page.tsx)
- [x] STEP 7: UI polish pass

## What "Done" Means Per Step
Each step is done when:
1. The file compiles with zero TypeScript errors
2. `next build` passes (run after step 6)
3. The component renders correctly in the browser (manual check)
4. For step 1: Jest test passes

## Common Mistakes to Avoid
- Using blur box-shadow instead of flat ink shadow
- Importing a UI library instead of hand-crafting doodle components
- Sending full-resolution images to the API
- Using Inter or system fonts anywhere
- Adding border-radius > 10px anywhere
- Forgetting to update the Build Status checklist above