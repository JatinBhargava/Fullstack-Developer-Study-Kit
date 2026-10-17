# Fullstack Developer Study Kit

A self-contained interview-preparation site for a backend-leaning Software Engineer loop:
Java, system design, React and TypeScript, DSA, mathematics, and the platform
side — AI engineering, containers and AWS.

Fourteen static HTML pages and no build step. Open one in a browser and it
works. Optional accounts save progress from every page to Postgres, using a
few Vercel Functions and a Neon database. See [Accounts](#accounts).

---

## What's in it

### Ledgers — daily practice

| Page                                  | Contents                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **90-Day Ledger** (`index.html`)      | 90 days × Java + System Design + React + DSA. **270 written model answers**, 232 named LeetCode problems, 360 tick-boxes |
| **Platform Ledger** (`platform.html`) | 60 days × AI Engineering + Docker/Kubernetes + AWS. **180 written model answers**, 180 tick-boxes                        |
| **AI Engineering Weekly Log** (`aiplan.html`) | 22 weeks × AI Engineering then React. **22 named projects**, 264 tick-boxes, per-week status, dates, hours and notes |
| **AI Engineering Roadmap** (`roadmap.html`) | 5 parts, 50 chapters, **612 topics**, each with a three-state status and a note. **Sign in to save progress to your account** |

Each question comes with a _Must cover_ line — the marking scheme — a study
link, and a collapsible model answer written to be spoken aloud in about two
minutes, with follow-up questions an interviewer is likely to ask next.

Every DSA problem on the ledger and the syllabus carries two controls: a
**tick** for solved, and a red **?** for "I got through it but I do not really
understand it". Both are keyed by LeetCode slug and shared between the two
pages. Flagged problems collect in the **Doubt list** at the top of the
syllabus' DSA Patterns track, grouped by pattern and marked where you have
already solved them — solving does not clear the flag, you do.

The **Weekly Log** is the execution plan rather than a drill. Twelve weeks take
a backend engineer to agentic AI engineering; ten more cover React and the AI
front end. Every week carries a _Learn_ and a _Build_ checklist, one named
project, a **ship gate** that decides whether the week counts, an interview
checkpoint to answer out loud, and a log row — status, start and finish dates,
hours, and short notes. **Export** and **Import** write the whole log to a JSON
file, which is the only way to move progress between origins.

Each week also has a **Files** panel: a link field for the repository, Colab or
Drive location of that week's project, plus attachments — pick individual files,
pick a whole project folder, or drag either onto the panel. Attachments are held
in the browser's IndexedDB for that origin (25 MB a file, 150 MB a week); an
attached folder is downloaded back as a single `.zip`, and `.git`, `node_modules`
and other build directories are skipped on the way in. **Export covers the log,
not the attachments** — the link field is the copy that survives.

### Syllabus — the map

**`syllabus.html`** — the same material re-cut by topic instead of by date.
**1,332 topics across 81 levels in 10 tracks**, each level with a _Done when_
completion criterion and reference links. Use it to work one subject
end-to-end rather than day by day.

Two tracks map to neither ledger. **Spring Boot** (181 topics, 12 levels) runs
from starters and the bean container through the web layer, JPA and
transactions, security, messaging, testing and production operations, to
reactive and virtual threads — the Java track surveys Spring in a single level,
this is the full treatment. **ML Engineering** (177 topics, 12 levels) is the
discipline next door to AI Engineering and a different job: problem framing,
data, classical methods, evaluation, deep learning, training at scale, feature
stores, serving, MLOps, drift monitoring and ranking systems.

**Study tools** sit above the tracks. **Quiz me** gives you a topic plus its
interview follow-ups; answer out loud, reveal the notes, then rate yourself
_Didn't know_, _Shaky_ or _Knew it_. Ratings schedule each topic to come back
(1, 3, 7, 16, 35, 90 days), and **Review** works through whatever is due.
**Mock interview** draws timed random questions across the tracks you pick,
weighted towards topics you have not seen or got wrong. A coloured dot on each
topic number shows its last rating, and the 90-Day Ledger's home page shows how
many topics are due. Only topics with written notes are asked.

**Answer log.** Every quiz, review and mock card has an answer box: type, or
dictate where the browser allows the microphone. When you reveal, your answer
is saved and scored against that topic's notes (which key points you covered
and which you missed), and a rating is suggested. On the published artifact a
**Get Claude's feedback** button grades the answer against the notes: a 0–10
score, strengths, gaps, errors, a stronger answer, and habit tags such as _no
trade-offs_ or _no example_. **My answers** pulls every attempt together: your
averages, the habits flagged most often, weakest topics (with a one-click
re-answer session), the key points you most often leave out, a per-track
table, and your recent answers. On the published page, **Coach me** asks Claude
for a short plan based on all of it. Answers are stored in this browser's
IndexedDB; export them to JSON from _My answers_.

### Guides — reference books

Chapter-wise, first principles to interview depth. Read in order, or jump in.

| Book                                                  | Chapters |
| ----------------------------------------------------- | -------- |
| **Java Ground Up** (`java.html`)                      | 56       |
| **System Design Ground Up** (`systemdesign.html`)     | 58       |
| **TypeScript & React Ground Up** (`typescript.html`)  | 62       |
| **AI Engineering Ground Up** (`ai.html`)              | 83       |
| **Docker & Kubernetes Ground Up** (`kubernetes.html`) | 58       |
| **AWS Ground Up** (`aws.html`)                        | 60       |
| **Databases Ground Up** (`db.html`)                   | 66       |
| **Mathematics Ground Up** (`math.html`)               | 69       |

**512 chapters.** Each opens with a one-line summary, then explanation, worked
code, principle callouts, and an _Interview angle_ note on what an interviewer
is actually testing.

**AI Engineering Ground Up** covers the model as a black box for most of its
length, but Part II goes inside the transformer — the NLP lineage, attention,
the block, positional encoding, tokenisation, scaling — because the
architecture explains the cost model and half the failure modes. Part VI is
the agent harness: permissions, budgets, idempotency, context engineering,
compaction, sandboxing, MCP and termination.

**Mathematics Ground Up** additionally carries a **problem set after every
chapter** — 976 exercises in total, each tagged _Theory_ or _Program_ and each
with a collapsible worked solution. Ten parts run from proof and induction
through number theory, combinatorics, probability, linear algebra, transforms,
geometry, games and machine arithmetic. An _Open all solutions_ button in the
masthead expands every answer at once.

---

## Running it locally

Double-click **`serve.command`**, or:

```bash
python3 -m http.server 8090
```

Then open **http://localhost:8090**.

macOS may block `serve.command` the first time — right-click → **Open** →
**Open**. That approval is needed once.

### Keep the port the same

Signed out, progress is stored in the browser's `localStorage`, which is **per origin**.
`http://localhost:8090` and `http://localhost:3000` are different origins and
keep entirely separate progress. Pick one and stay on it.

---

## Deploying

It is a static site, so any static host works. For Vercel:

```bash
npx vercel          # first run: log in and answer the prompts
npx vercel --prod   # thereafter
```

Or import the repository at **vercel.com → Add New → Project**, framework
preset **Other**, with build command and output directory left empty.

`vercel.json` sets security headers and `noindex`. `.vercelignore` keeps local
helper files out of the deployment.

> **A deployed copy is publicly readable.** Vercel's free tier has no password
> protection on production deployments. If it needs to be private, use
> deployment protection on a paid plan, put Cloudflare Access in front of it,
> or just keep running it locally.

> Deploying also creates a **new origin**, so signed-out progress does not
> follow. Sign in on both to carry it across.

---

## How it works

Every page is a single self-contained HTML file with inline CSS and JavaScript.
The only external request is to Google Fonts, and font-stack fallbacks are
declared, so the pages render correctly offline.

- **Progress** — tick-boxes and expanded panels persist in `localStorage`;
  signed in, `sync.js` also saves them to your account
- **Theme** — follows your OS light/dark setting, with a manual toggle
- **Navigation** — two dropdowns, _Ledgers_ and _Guides_, on every page
- **Search** — the _Search_ button, `Ctrl/Cmd+K` or `/` on any page searches
  syllabus topics and notes, guide chapters, ledger questions, weekly-log steps
  and problems. Choosing a result opens the page at that item, expanding
  whatever tab or panel it sits in. The index is `search-index.js`, loaded on
  first use
- **Responsive** — works on a phone; wide code blocks scroll independently

Apart from accounts (below) there is no backend, and the only cookie is the
session cookie, set when you sign in. When deployed to Vercel, **Vercel Web
Analytics** records anonymous page views — it is cookieless and does not
identify visitors. Running locally, that script 404s and nothing is collected.
To remove it entirely, delete the `/_vercel/insights/script.js` tag.

---

## Accounts

Every page works signed out, storing progress in the browser as before. Sign
in from the button beside **Search** on any page, and progress from every page
is saved to Postgres and follows you to any browser.

**What syncs**

| Page | Synced | Stays in the browser |
| --- | --- | --- |
| 90-Day Ledger, Platform Ledger, Codeforces Ladders | ticks, links, start date, DSA solved and doubt flags | — |
| Syllabus | ticks, notes, quiz ratings and review schedule, the answer log | attached code files |
| AI Engineering Weekly Log | ticks, status, dates, hours, notes, links | file attachments |
| AI Engineering Roadmap | status and note per topic (its own sync, below) | — |
| Guides | nothing to sync | colour theme |

**How the site-wide sync works** (`sync.js`, loaded first in every page's
`<head>`). Pages still read and write `localStorage` exactly as before.
`sync.js` wraps `Storage.prototype` for the tracked keys and turns each write
into per-item changes (one tick, one quiz rating) against what that page last
read. Signed in, the changes go to `api/sync.js` about a second later, and
offline they queue and retry. Newer edits win per item, so ticks made on two
devices both survive. Changes from other devices are pulled on load. Pages
that already redraw on cross-tab `storage` events update in place; the others
reload once, or show a *Reload* bar if you have already started clicking.

The first sign-in in a browser adds everything already done there to the
account; where both have the same item, the account's copy wins. Signing out
removes progress from that browser (it stays in the account).

**Roadmap.** `roadmap.html` predates `sync.js` and keeps its own endpoint,
`api/progress.js`, with one row per topic. It shares the same accounts and
session.

**Pieces**

| Path | What it is |
| --- | --- |
| `sync.js` | The client: storage wrapper, queue, pull and merge, Sign in button and dialog |
| `api/sync.js` | `GET ?since=` returns changes after a cursor; `PUT` upserts a batch. Only the tracked keys are accepted |
| `api/auth/signup.js`, `login.js`, `logout.js`, `me.js` | Email + password accounts. Passwords are hashed with scrypt; sessions are random tokens in an `HttpOnly`, `SameSite=Lax` cookie, stored in the database as SHA-256 hashes, 30 days |
| `api/progress.js` | The roadmap's progress endpoint |
| `api/_lib/` | Database client (`@neondatabase/serverless`), session and throttling helpers. The underscore keeps Vercel from turning them into endpoints |
| `db/schema.sql` | `users`, `sessions`, `site_sync`, `roadmap_progress`, `auth_attempts`. Idempotent |

State-changing endpoints accept only same-origin `application/json`, which
together with the `SameSite` cookie blocks cross-site form posts. Failed
sign-ins are throttled per email and per IP.

**Adding a page or key to sync:** add the key to `TRACK` in `sync.js` and to
`KEYS` in `api/sync.js`, and load `sync.js` in the page's `<head>` before any
other script.

**Setup** — needs the Vercel CLI (`npm i -g vercel`):

```bash
vercel link                                   # connect the folder to the Vercel project
vercel integration add neon                   # provision Neon; sets DATABASE_URL on the project
vercel env pull .env.local                    # copy DATABASE_URL locally
npm install
npm run db:migrate                            # create the tables
vercel --prod                                 # deploy
```

**Running it locally with accounts:** `vercel dev` serves the pages and the
API together. `python3 -m http.server` still works, but sign-in is hidden,
because there is no API to call.

**Editing the outline:** the roadmap is generated from `tools/roadmap.txt`.
Edit it, then run

```sh
python3 tools/build-roadmap.py && python3 tools/build-search-index.py
```

A topic's number (`1.1`, `22.4`) is its key in the database, so renumbering a
topic detaches the progress saved against the old number.

---

## Editing the content

The HTML in this repository is **generated output**, not hand-written source.
Each page is produced by a Python builder that renders JSON content files into
a single self-contained document, with a shared module supplying the navigation
and footer.

Editing a `.html` file directly works, and the next rebuild overwrites it.

The search index is the exception: it is built from the pages themselves.
After changing any page, regenerate it with

```sh
python3 tools/build-search-index.py
```

> The generators are not currently in this repository. Until they are, treat
> these pages as build artefacts — clone them, read them, deploy them, but
> expect direct edits to be lost on the next regeneration.

---

## Licence

Personal study material, shared as-is. No warranty that any of it is correct —
verify anything you intend to rely on.
