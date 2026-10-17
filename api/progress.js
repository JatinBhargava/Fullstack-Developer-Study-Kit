import { db } from "./_lib/db.js";
import { json, readJson, route, HttpError } from "./_lib/http.js";
import { requireUser } from "./_lib/auth.js";

const TOPIC = /^\d{1,2}\.\d{1,2}$/;
const MAX_ITEMS = 1000;
const MAX_NOTE = 4000;

// GET /api/progress -> { items: { "1.1": { s, n, u } } }   (u = epoch ms)
export const GET = route(async (req) => {
  const user = await requireUser(req);
  const rows = await db()`
    select topic_id, status, note, (extract(epoch from updated_at) * 1000)::float8 as u
    from roadmap_progress where user_id = ${user.id}`;
  const items = {};
  for (const r of rows) items[r.topic_id] = { s: r.status, n: r.note, u: Math.round(r.u) };
  return json({ items });
});

// PUT /api/progress  { items: [{ id, s, n, u }] }
// Per-topic last-write-wins on u, so a stale tab or an offline queue that
// flushes late cannot overwrite a newer edit.
export const PUT = route(async (req) => {
  const user = await requireUser(req);
  const body = await readJson(req);
  if (!Array.isArray(body.items)) throw new HttpError(400, "Expected items[].");
  if (body.items.length > MAX_ITEMS) throw new HttpError(413, "Too many items in one request.");

  const now = Date.now();
  const latest = new Map();
  for (const it of body.items) {
    const id = String(it?.id ?? "");
    const s = Number(it?.s);
    const n = typeof it?.n === "string" ? it.n : "";
    const u = Math.min(Number(it?.u), now);
    if (!TOPIC.test(id) || ![0, 1, 2].includes(s) || !Number.isFinite(u) || u <= 0) {
      throw new HttpError(400, `Invalid item for topic "${id.slice(0, 8)}".`);
    }
    if (n.length > MAX_NOTE) throw new HttpError(400, `Note on ${id} is longer than ${MAX_NOTE} characters.`);
    const prev = latest.get(id);
    if (!prev || prev.u <= u) latest.set(id, { id, s, n, u });
  }
  if (!latest.size) return json({ saved: 0 });

  const list = [...latest.values()];
  const saved = await db()`
    insert into roadmap_progress (user_id, topic_id, status, note, updated_at)
    select ${user.id}, t.id, t.s, t.n, to_timestamp(t.u / 1000.0)
    from unnest(${list.map((x) => x.id)}::text[],
                ${list.map((x) => x.s)}::smallint[],
                ${list.map((x) => x.n)}::text[],
                ${list.map((x) => x.u)}::float8[]) as t(id, s, n, u)
    on conflict (user_id, topic_id) do update
      set status = excluded.status, note = excluded.note, updated_at = excluded.updated_at
      where roadmap_progress.updated_at < excluded.updated_at
    returning topic_id`;
  return json({ saved: saved.length });
});
