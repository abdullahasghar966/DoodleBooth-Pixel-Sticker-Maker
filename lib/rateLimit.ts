// Per-IP daily rate limiter for /api/pixelate.
//
// Production: Vercel KV / Upstash Redis via REST API (no SDK needed —
// just `fetch`, which works on Edge runtime).
// Dev (no KV creds): in-memory Map. Resets on server restart, which is fine
// for local development.

export const RATE_LIMIT_DAILY = 5;
const ONE_DAY_SECONDS = 24 * 60 * 60;

const inMemoryStore = new Map<string, { count: number; expiresAt: number }>();

function dayKey(ip: string): string {
  // UTC date so the boundary is consistent regardless of server timezone.
  const day = new Date().toISOString().slice(0, 10);
  return `pixelate:${ip}:${day}`;
}

async function kvIncrWithExpire(key: string): Promise<number | null> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;

  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, ONE_DAY_SECONDS],
      ]),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ result?: number }>;
    const incr = data?.[0]?.result;
    return typeof incr === "number" ? incr : null;
  } catch {
    return null;
  }
}

function inMemoryIncr(key: string): number {
  const now = Date.now();
  const entry = inMemoryStore.get(key);
  if (!entry || entry.expiresAt < now) {
    inMemoryStore.set(key, {
      count: 1,
      expiresAt: now + ONE_DAY_SECONDS * 1000,
    });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

export type RateLimitResult = {
  allowed: boolean;
  used: number;
  remaining: number;
};

export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  const key = dayKey(ip);
  const used = (await kvIncrWithExpire(key)) ?? inMemoryIncr(key);
  return {
    allowed: used <= RATE_LIMIT_DAILY,
    used,
    remaining: Math.max(0, RATE_LIMIT_DAILY - used),
  };
}
