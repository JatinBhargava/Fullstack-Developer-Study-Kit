-- Schema for the AI Engineering Roadmap accounts and progress.
-- Idempotent: safe to run again. Apply with `npm run db:migrate`.

create table if not exists users (
  id            bigint generated always as identity primary key,
  email         text        not null unique,          -- stored trimmed and lower-cased
  password_hash text        not null,                 -- scrypt$N$r$p$salt$hash
  created_at    timestamptz not null default now()
);

-- Opaque session tokens. Only the SHA-256 of the token is stored, so a
-- database leak does not hand out live sessions.
create table if not exists sessions (
  token_hash text        primary key,
  user_id    bigint      not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_user_idx    on sessions (user_id);
create index if not exists sessions_expires_idx on sessions (expires_at);

-- One row per user per roadmap topic ("1.1", "22.4", ...).
-- status: 0 not started, 1 in progress, 2 done.
-- updated_at is the client edit time; the newer write wins per topic.
create table if not exists roadmap_progress (
  user_id    bigint      not null references users(id) on delete cascade,
  topic_id   text        not null check (topic_id ~ '^[0-9]{1,2}\.[0-9]{1,2}$'),
  status     smallint    not null default 0 check (status between 0 and 2),
  note       text        not null default '' check (length(note) <= 4000),
  updated_at timestamptz not null,
  primary key (user_id, topic_id)
);

-- Sign-in and sign-up attempts, for throttling. Rows older than a day are pruned.
create table if not exists auth_attempts (
  id    bigint generated always as identity primary key,
  kind  text        not null check (kind in ('login', 'signup')),
  email text        not null,
  ip    text        not null,
  ok    boolean     not null,
  at    timestamptz not null default now()
);
create index if not exists auth_attempts_email_idx on auth_attempts (email, at);
create index if not exists auth_attempts_ip_idx    on auth_attempts (ip, at);

-- Site-wide progress sync (sync.js): one row per user per stored item.
-- skey is a localStorage key or "idb:<db>"; field is the item path inside it.
-- updated_at is the client edit time (newer wins); seq orders changes for
-- incremental pulls; written_at is server time, used to hold back rows for a
-- few seconds so a pull never skips a lower seq that is still committing.
create sequence if not exists site_sync_seq;
create table if not exists site_sync (
  user_id    bigint      not null references users(id) on delete cascade,
  skey       text        not null,
  field      text        not null check (length(field) <= 300),
  value      jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null,
  written_at timestamptz not null default now(),
  seq        bigint      not null,
  primary key (user_id, skey, field)
);
create index if not exists site_sync_user_seq_idx on site_sync (user_id, seq);
