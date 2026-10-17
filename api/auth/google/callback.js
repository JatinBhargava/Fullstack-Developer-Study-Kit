import { timingSafeEqual } from "node:crypto";
import { db } from "../../_lib/db.js";
import { makeCookie, readCookie, startSession } from "../../_lib/auth.js";
import { exchange, safeNext, STATE_COOKIE } from "../../_lib/google.js";

function back(req, next, cookies, param, value) {
  const url = new URL(next, new URL(req.url).origin);
  url.searchParams.set(param, value);
  const headers = new Headers({ location: url.pathname + url.search + url.hash, "cache-control": "no-store" });
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(null, { status: 302, headers });
}

function sameState(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

// GET /api/auth/google/callback?code&state -> session cookie, back to the page
export async function GET(req) {
  const url = new URL(req.url);
  const clear = makeCookie(req, STATE_COOKIE, "", 0, "/api/auth/google");
  let saved = {};
  try { saved = JSON.parse(readCookie(req, STATE_COOKIE) || "{}"); } catch {}
  const next = safeNext(saved.next);

  if (url.searchParams.get("error")) return back(req, next, [clear], "ss_error", "Google sign-in was cancelled.");
  if (!saved.state || !sameState(saved.state, url.searchParams.get("state"))) {
    return back(req, next, [clear], "ss_error", "Google sign-in expired. Please try again.");
  }

  try {
    const g = await exchange(req, url.searchParams.get("code") || "", saved.verifier);
    if (!g.verified || !g.email) return back(req, next, [clear], "ss_error", "Your Google account's email is not verified.");

    const sql = db();
    // 1. returning Google user  2. existing email account: link it  3. new account
    let [user] = await sql`select id from users where google_sub = ${g.sub}`;
    if (!user) [user] = await sql`update users set google_sub = ${g.sub} where email = ${g.email} and google_sub is null returning id`;
    if (!user) [user] = await sql`insert into users (email, google_sub) values (${g.email}, ${g.sub}) on conflict (email) do nothing returning id`;
    if (!user) return back(req, next, [clear], "ss_error", "That email is already linked to a different Google account.");

    return back(req, next, [clear, await startSession(req, user.id)], "ss", "google");
  } catch (err) {
    console.error(err);
    return back(req, next, [clear], "ss_error", "Google sign-in failed. Please try again.");
  }
}
