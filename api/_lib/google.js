import { randomBytes, createHash } from "node:crypto";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
export const STATE_COOKIE = "g_oauth";

export function googleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// Must match an "Authorized redirect URI" on the Google OAuth client exactly.
export function redirectUri(req) {
  const u = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || u.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || u.host;
  return `${proto}://${host}/api/auth/google/callback`;
}

// Only same-site paths, so the redirect cannot be bent to another site.
export function safeNext(next) {
  const n = String(next || "/");
  return n.length <= 300 && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : "/";
}

export function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

export function authUrl(req, state, challenge) {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(req),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${AUTH_URL}?${q}`;
}

// Exchanges the code and returns the verified identity. The ID token comes
// straight from Google's token endpoint over TLS, authenticated with our
// client secret, so its claims are checked but its signature need not be.
export async function exchange(req, code, verifier) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(req),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.id_token) throw new Error("Google token exchange failed: " + (body.error || res.status));

  const claims = JSON.parse(Buffer.from(body.id_token.split(".")[1] || "", "base64url").toString("utf8"));
  if (claims.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error("ID token audience mismatch");
  if (!ISSUERS.has(claims.iss)) throw new Error("ID token issuer mismatch");
  if (!(claims.exp * 1000 > Date.now())) throw new Error("ID token expired");
  return {
    sub: String(claims.sub),
    email: String(claims.email || "").trim().toLowerCase(),
    verified: claims.email_verified === true || claims.email_verified === "true",
  };
}
