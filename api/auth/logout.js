import { json, readJson, route } from "../_lib/http.js";
import { endSession } from "../_lib/auth.js";

export const POST = route(async (req) => {
  await readJson(req);
  return json({ ok: true }, 200, { "set-cookie": await endSession(req) });
});
