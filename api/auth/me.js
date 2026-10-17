import { json, route } from "../_lib/http.js";
import { currentUser } from "../_lib/auth.js";
import { googleConfigured } from "../_lib/google.js";

// 200 either way: being signed out is a normal state, not an error.
export const GET = route(async (req) => json({ user: await currentUser(req), providers: { google: googleConfigured() } }));
