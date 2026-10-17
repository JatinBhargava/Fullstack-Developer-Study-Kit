import { db } from "../_lib/db.js";
import { json, readJson, route, HttpError } from "../_lib/http.js";
import { credentials, hashPassword, throttle, recordAttempt, startSession } from "../_lib/auth.js";

export const POST = route(async (req) => {
  const { email, password } = credentials(await readJson(req));
  await throttle("signup", email, req);

  const hash = await hashPassword(password);
  const [user] = await db()`
    insert into users (email, password_hash) values (${email}, ${hash})
    on conflict (email) do nothing
    returning id, email`;
  await recordAttempt("signup", email, req, !!user);
  if (!user) throw new HttpError(409, "An account with that email already exists. Sign in instead.");

  const setCookie = await startSession(req, user.id);
  return json({ user: { id: Number(user.id), email: user.email } }, 201, { "set-cookie": setCookie });
});
