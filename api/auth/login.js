import { db } from "../_lib/db.js";
import { json, readJson, route, HttpError } from "../_lib/http.js";
import { credentials, verifyPassword, burnTime, throttle, recordAttempt, startSession } from "../_lib/auth.js";

export const POST = route(async (req) => {
  const { email, password } = credentials(await readJson(req));
  await throttle("login", email, req);

  const [user] = await db()`select id, email, password_hash from users where email = ${email}`;
  let ok = false;
  if (user) ok = await verifyPassword(password, user.password_hash);
  else await burnTime(password);
  await recordAttempt("login", email, req, ok);
  if (!ok) throw new HttpError(401, "Email or password is incorrect.");

  const setCookie = await startSession(req, user.id);
  return json({ user: { id: Number(user.id), email: user.email } }, 200, { "set-cookie": setCookie });
});
