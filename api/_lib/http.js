export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

// Wraps a handler: turns HttpError into a JSON error, hides everything else.
export function route(fn) {
  return async (req) => {
    try {
      return await fn(req);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error(err);
      return json({ error: "Something went wrong on the server." }, 500);
    }
  };
}

// State-changing requests must be same-origin JSON. A cross-site form post
// can neither send application/json nor forge the Origin header.
export async function readJson(req, maxBytes = 256 * 1024) {
  const origin = req.headers.get("origin");
  if (origin) {
    let host;
    try { host = new URL(origin).host; } catch { host = ""; }
    if (host !== req.headers.get("host")) throw new HttpError(403, "Cross-origin request refused.");
  }
  if (!(req.headers.get("content-type") || "").startsWith("application/json")) {
    throw new HttpError(415, "Expected application/json.");
  }
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request too large.");
  try {
    return JSON.parse(text || "{}");
  } catch {
    throw new HttpError(400, "Malformed JSON.");
  }
}

export function clientIp(req) {
  return (
    req.headers.get("x-real-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown"
  );
}
