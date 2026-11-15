/**
 * Visitor / play counter for the portfolio. Runs as a Vercel serverless function.
 *
 *   POST /api/counts   body: {"key":"view"} | {"key":"project:<slug>"} | {"key":"song:<slug>"}
 *   GET  /api/counts   -> {"view": 12, "project:kincard-dementia-care-app": 4, ...}
 *
 * Storage: one Redis hash ("counts") on Upstash, reached over its REST API.
 * Vercel fills in the two env vars below when you connect an Upstash Redis store.
 */
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// Sites allowed to call this API. Override with a comma-separated ALLOWED_ORIGINS env var.
const ALLOWED = (process.env.ALLOWED_ORIGINS || "https://alexanderlee2008.github.io")
  .split(",").map(s => s.trim()).filter(Boolean);

const HASH = "counts";
const KEY_RE = /^(view|(project|song):[a-z0-9-]{1,40})$/;
const MAX_KEYS = 200;                       // stops junk keys from filling the store
const MAX_PER_MINUTE = 30;                  // writes allowed per visitor address per minute

/** Run one Redis command, e.g. redis(["HINCRBY", "counts", "view", 1]) */
async function redis(cmd) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd)
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

function originAllowed(req) {
  const o = req.headers.origin;
  if (!o) return true;                                        // same-origin GET, curl
  if (ALLOWED.includes(o)) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) return true;   // local testing
  try { return new URL(o).host === req.headers.host; } catch (e) { return false; }
}

module.exports = async function handler(req, res) {
  const ok = originAllowed(req);
  if (ok && req.headers.origin) {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (!ok) return res.status(403).json({ error: "origin not allowed" });
  if (!REDIS_URL || !REDIS_TOKEN) return res.status(500).json({ error: "Redis is not connected" });

  try {
    if (req.method === "GET") {
      const flat = (await redis(["HGETALL", HASH])) || [];    // [field, value, field, value, ...]
      const out = {};
      for (let i = 0; i < flat.length; i += 2) out[flat[i]] = Number(flat[i + 1]);
      return res.status(200).json(out);
    }
    if (req.method === "POST") {
      let body = req.body;                                    // the site posts JSON as text/plain
      if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
      const key = body && body.key;
      if (typeof key !== "string" || !KEY_RE.test(key)) return res.status(400).json({ error: "bad key" });
      // Simple rate limit: a per-address counter that expires after a minute
      const ip = String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
      const used = await redis(["INCR", "rl:" + ip]);
      if (used === 1) await redis(["EXPIRE", "rl:" + ip, 60]);
      if (used > MAX_PER_MINUTE) return res.status(429).json({ error: "slow down" });
      const exists = await redis(["HEXISTS", HASH, key]);
      if (!exists && (await redis(["HLEN", HASH])) >= MAX_KEYS) return res.status(400).json({ error: "too many keys" });
      const n = await redis(["HINCRBY", HASH, key, 1]);
      return res.status(200).json({ key, count: n });
    }
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(502).json({ error: "storage error" });
  }
};
