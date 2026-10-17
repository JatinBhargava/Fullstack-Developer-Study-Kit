import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { db } from "./db.js";
import { HttpError, clientIp } from "./http.js";

const scrypt = promisify(scryptCb);

const COOKIE = "rm_session";
const SESSION_DAYS = 30;
const N = 16384, R = 8, P = 1, KEYLEN = 64;

// ---- passwords ------------------------------------------------------------

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password, stored) {
  const [alg, n, r, p, salt, hash] = String(stored).split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(hash, "base64");
  const key = await scrypt(password, Buffer.from(salt, "base64"), expected.length, {
    N: Number(n), r: Number(r), p: Number(p),
  });
  return timingSafeEqual(key, expected);
}

// Spent on unknown emails so a miss takes as long as a wrong password.
const DUMMY_HASH = await hashPassword(randomBytes(12).toString("hex"));
export const burnTime = (password) => verifyPassword(password, DUMMY_HASH);

// ---- input ----------------------------------------------------------------

export function credentials(body) {
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "Enter a valid email address.");
  }
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters.");
  if (password.length > 200) throw new HttpError(400, "Password must be at most 200 characters.");
  return { email, password };
}

// ---- throttling -----------------------------------------------------------

const LIMITS = {
  login:  { email: 8,  ip: 40, window: "15 minutes" },
  signup: { email: 3,  ip: 10, window: "1 hour" },
};

export async function throttle(kind, email, req) {
  const sql = db();
  const ip = clientIp(req);
  const { window, ...max } = LIMITS[kind];
  // Logins count failures only; sign-ups count every attempt.
  const [row] = await sql`
    select count(*) filter (where email = ${email})::int as by_email,
           count(*) filter (where ip = ${ip})::int       as by_ip
    from auth_attempts
    where kind = ${kind} and (kind = 'signup' or not ok)
      and at > now() - ${window}::interval
      and (email = ${email} or ip = ${ip})`;
  if (row.by_email >= max.email || row.by_ip >= max.ip) {
    throw new HttpError(429, "Too many attempts. Wait a few minutes and try again.");
  }
}

export async function recordAttempt(kind, email, req, ok) {
  const sql = db();
  await sql`insert into auth_attempts (kind, email, ip, ok) values (${kind}, ${email}, ${clientIp(req)}, ${ok})`;
  if (Math.random() < 0.05) {
    await sql`delete from auth_attempts where at < now() - interval '1 day'`;
    await sql`delete from sessions where expires_at < now()`;
  }
}

// ---- sessions -------------------------------------------------------------

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

function readCookie(req, name) {
  for (const part of (req.headers.get("cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function cookie(req, value, maxAge) {
  const local = new URL(req.url).protocol === "http:";
  return [
    `${COOKIE}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`,
    ...(local ? [] : ["Secure"]),
  ].join("; ");
}

// Returns the Set-Cookie header value for a fresh session.
export async function startSession(req, userId) {
  const token = randomBytes(32).toString("base64url");
  await db()`
    insert into sessions (token_hash, user_id, expires_at)
    values (${sha256(token)}, ${userId}, now() + ${SESSION_DAYS + " days"}::interval)`;
  return cookie(req, token, SESSION_DAYS * 86400);
}

export async function endSession(req) {
  const token = readCookie(req, COOKIE);
  if (token) await db()`delete from sessions where token_hash = ${sha256(token)}`;
  return cookie(req, "", 0);
}

export async function currentUser(req) {
  const token = readCookie(req, COOKIE);
  if (!token) return null;
  const [user] = await db()`
    select u.id, u.email
    from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${sha256(token)} and s.expires_at > now()`;
  return user ? { id: Number(user.id), email: user.email } : null;
}

export async function requireUser(req) {
  const user = await currentUser(req);
  if (!user) throw new HttpError(401, "Sign in to continue.");
  return user;
}
