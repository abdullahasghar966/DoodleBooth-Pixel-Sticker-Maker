// Thin wrapper around @anthropic-ai/sdk for the pixelate route.
// Keeps the route handler focused on request/response plumbing.

import Anthropic from "@anthropic-ai/sdk";

export const PIXELATE_SYSTEM_PROMPT = `You are a pixel art generator specializing in doodle-aesthetic 8-bit portraits.
Given a face photograph crop, analyze the face and return a JSON object
describing how to render it as pixel art. You must:
1. Map the face to a 64×64 pixel grid
2. Use ONLY colors from the provided palette (max 8 colors)
3. Apply Bayer 4×4 ordered dithering logic for color transitions
4. Identify key facial landmarks (eyes, nose, mouth) with pixel coordinates
5. Choose the most expressive emotion from: happy | cool | surprised | sleepy | neutral
6. Suggest one overlay from: wiggle_border | crosshatch | star_burst | none
Return ONLY valid JSON. No prose. No markdown. No explanation.`;

export type ClaudePixelateInput = {
  imageBase64: string;
  paletteName: string;
  paletteHex: readonly string[];
  mode: string;
};

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

/**
 * Calls Claude Vision with the face crop and returns the raw text response.
 * Validation is the caller's responsibility.
 *
 * Privacy: this function never logs the image. The SDK call discards both
 * the image and the response once awaited; nothing persists server-side.
 */
export async function callClaudePixelate(
  input: ClaudePixelateInput,
): Promise<string> {
  const client = getClient();

  const userText = [
    `Palette name: ${input.paletteName}`,
    `Palette hex colors (use ONLY these, max 8): ${input.paletteHex.join(", ")}`,
    `Mode: ${input.mode}`,
    "",
    "Return JSON with this exact shape (no markdown, no commentary):",
    "{",
    `  "pixels": <64 rows × 64 columns; each cell is an integer palette index 0..${input.paletteHex.length - 1}>,`,
    '  "landmarks": {',
    '    "eye_left":  { "x": <0..63>, "y": <0..63> },',
    '    "eye_right": { "x": <0..63>, "y": <0..63> },',
    '    "nose":      { "x": <0..63>, "y": <0..63> },',
    '    "mouth":     { "x": <0..63>, "y": <0..63> }',
    "  },",
    '  "expression": "happy" | "cool" | "surprised" | "sleepy" | "neutral",',
    '  "overlay":    "wiggle_border" | "crosshatch" | "star_burst" | "none",',
    '  "confidence": <number 0..1>',
    "}",
  ].join("\n");

  const message = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 4096,
    temperature: 0,
    system: PIXELATE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: input.imageBase64,
            },
          },
          { type: "text", text: userText },
        ],
      },
    ],
  });

  return message.content
    .filter((block) => block.type === "text")
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
}
