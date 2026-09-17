# Fullstack Developer Study Kit

A self-contained interview-preparation site for a backend-leaning Software Engineer loop:
Java, system design, React and TypeScript, DSA, mathematics, and the platform
side — AI engineering, containers and AWS.

Thirteen static HTML pages, no build step, no dependencies, no server-side code.
Open one in a browser and it works.

---

## What's in it

### Ledgers — daily practice

| Page                                  | Contents                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **90-Day Ledger** (`index.html`)      | 90 days × Java + System Design + React + DSA. **270 written model answers**, 232 named LeetCode problems, 360 tick-boxes |
| **Platform Ledger** (`platform.html`) | 60 days × AI Engineering + Docker/Kubernetes + AWS. **180 written model answers**, 180 tick-boxes                        |
| **AI Engineering Weekly Log** (`aiplan.html`) | 22 weeks × AI Engineering then React. **22 named projects**, 264 tick-boxes, per-week status, dates, hours and notes |

Each question comes with a _Must cover_ line — the marking scheme — a study
link, and a collapsible model answer written to be spoken aloud in about two
minutes, with follow-up questions an interviewer is likely to ask next.

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
**974 topics across 57 levels in 8 tracks**, each level with a _Done when_
completion criterion and reference links. Use it to work one subject
end-to-end rather than day by day.

### Guides — reference books

Chapter-wise, first principles to interview depth. Read in order, or jump in.

| Book                                                  | Chapters |
| ----------------------------------------------------- | -------- |
| **Java Ground Up** (`java.html`)                      | 56       |
| **System Design Ground Up** (`systemdesign.html`)     | 58       |
| **TypeScript & React Ground Up** (`typescript.html`)  | 62       |
| **AI Engineering Ground Up** (`ai.html`)              | 56       |
| **Docker & Kubernetes Ground Up** (`kubernetes.html`) | 58       |
| **AWS Ground Up** (`aws.html`)                        | 60       |
| **Databases Ground Up** (`db.html`)                   | 66       |
| **Mathematics Ground Up** (`math.html`)               | 69       |

**485 chapters.** Each opens with a one-line summary, then explanation, worked
code, principle callouts, and an _Interview angle_ note on what an interviewer
is actually testing.

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

Progress is stored in the browser's `localStorage`, which is **per origin**.
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

> Deploying also creates a **new origin**, so tick progress does not follow —
> the hosted copy starts empty and stays separate from localhost.

---

## How it works

Every page is a single self-contained HTML file with inline CSS and JavaScript.
The only external request is to Google Fonts, and font-stack fallbacks are
declared, so the pages render correctly offline.

- **Progress** — tick-boxes and expanded panels persist in `localStorage`
- **Theme** — follows your OS light/dark setting, with a manual toggle
- **Navigation** — two dropdowns, _Ledgers_ and _Guides_, on every page
- **Responsive** — works on a phone; wide code blocks scroll independently

There is no backend and no cookies. When deployed to Vercel, **Vercel Web
Analytics** records anonymous page views — it is cookieless and does not
identify visitors. Running locally, that script 404s and nothing is collected.
To remove it entirely, delete the `/_vercel/insights/script.js` tag.

---

## Editing the content

The HTML in this repository is **generated output**, not hand-written source.
Each page is produced by a Python builder that renders JSON content files into
a single self-contained document, with a shared module supplying the navigation
and footer.

Editing a `.html` file directly works, and the next rebuild overwrites it.

> The generators are not currently in this repository. Until they are, treat
> these pages as build artefacts — clone them, read them, deploy them, but
> expect direct edits to be lost on the next regeneration.

---

## Licence

Personal study material, shared as-is. No warranty that any of it is correct —
verify anything you intend to rely on.
