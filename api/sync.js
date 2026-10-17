import { db } from "./_lib/db.js";
import { json, readJson, route, HttpError } from "./_lib/http.js";
import { requireUser } from "./_lib/auth.js";

// Keep in step with TRACK and IDB_KEY in /sync.js.
const KEYS = new Set([
  "sde2-ledger-v2", "sde2-dsa-done", "sde2-dsa-doubt", "sde2-srs", "sde2-syllabus-v2",
  "opsledger.v1", "ai-weekly-log.v1", "cp.v1", "idb:sde2-answers",
]);
const PAGE = 2000;
const MAX_CHANGES = 1000;
const MAX_VALUE = 256 * 1024;

// GET /api/sync?since=<seq> -> { changes: [{ k, f, v, d, u }], cursor, more }
export const GET = route(async (req) => {
  const user = await requireUser(req);
  const since = Math.max(0, Math.floor(Number(new URL(req.url).searchParams.get("since")) || 0));
  const rows = await db()`
    select skey, field, value, deleted, seq,
           (extract(epoch from updated_at) * 1000)::float8 as u
    from site_sync
    where user_id = ${user.id} and seq > ${since}
      and written_at < now() - interval '5 seconds'
    order by seq
    limit ${PAGE + 1}`;
  const more = rows.length > PAGE;
  const page = more ? rows.slice(0, PAGE) : rows;
  return json({
    changes: page.map((r) => ({ k: r.skey, f: r.field, v: r.deleted ? null : r.value, d: r.deleted, u: Math.round(r.u) })),
    cursor: page.length ? Number(page[page.length - 1].seq) : since,
    more,
  });
});

// PUT /api/sync { changes: [{ k, f, v, d, u }] } -> { saved }
// Per item, the newer edit time wins.
export const PUT = route(async (req) => {
  const user = await requireUser(req);
  const body = await readJson(req, 4 * 1024 * 1024);
  if (!Array.isArray(body.changes)) throw new HttpError(400, "Expected changes[].");
  if (body.changes.length > MAX_CHANGES) throw new HttpError(413, "Too many changes in one request.");

  const now = Date.now();
  const latest = new Map();
  for (const c of body.changes) {
    const k = String(c?.k ?? ""), f = String(c?.f ?? ""), d = c?.d === true;
    const u = Math.min(Number(c?.u), now);
    if (!KEYS.has(k)) throw new HttpError(400, `Key "${k.slice(0, 40)}" is not synced.`);
    if (f.length > 300) throw new HttpError(400, "Field name too long.");
    if (!Number.isFinite(u) || u <= 0) throw new HttpError(400, "Invalid edit time.");
    const v = d ? null : c?.v;
    if (!d && v === undefined) throw new HttpError(400, "Missing value.");
    if (!d && JSON.stringify(v).length > MAX_VALUE) throw new HttpError(413, `Value for ${k} is too large.`);
    const id = k + "\u0000" + f, prev = latest.get(id);
    if (!prev || prev.u <= u) latest.set(id, { k, f, v, d, u });
  }
  if (!latest.size) return json({ saved: 0 });

  const saved = await db()`
    insert into site_sync (user_id, skey, field, value, deleted, updated_at, seq)
    select ${user.id}, t.k, t.f, t.v, t.d, to_timestamp(t.u / 1000.0), nextval('site_sync_seq')
    from jsonb_to_recordset(${JSON.stringify([...latest.values()])}::jsonb)
      as t(k text, f text, v jsonb, d boolean, u float8)
    on conflict (user_id, skey, field) do update
      set value = excluded.value, deleted = excluded.deleted, updated_at = excluded.updated_at,
          seq = excluded.seq, written_at = now()
      where site_sync.updated_at < excluded.updated_at
    returning 1`;
  return json({ saved: saved.length });
});
