import { randomBytes } from "node:crypto";
import { route, HttpError } from "../../_lib/http.js";
import { makeCookie } from "../../_lib/auth.js";
import { googleConfigured, authUrl, pkce, safeNext, STATE_COOKIE } from "../../_lib/google.js";

// GET /api/auth/google/start?next=/page.html -> redirect to Google
export const GET = route(async (req) => {
  if (!googleConfigured()) throw new HttpError(404, "Google sign-in is not set up.");
  const state = randomBytes(24).toString("base64url");
  const { verifier, challenge } = pkce();
  const next = safeNext(new URL(req.url).searchParams.get("next"));
  const value = encodeURIComponent(JSON.stringify({ state, verifier, next }));
  return new Response(null, {
    status: 302,
    headers: {
      location: authUrl(req, state, challenge),
      "set-cookie": makeCookie(req, STATE_COOKIE, value, 600, "/api/auth/google"),
      "cache-control": "no-store",
    },
  });
});
