# Fullstack Developer Study Kit

A self-contained interview-preparation site for a backend-leaning SDE2 loop:
Java, system design, React and TypeScript, DSA, and the platform side —
AI engineering, containers and AWS.

Nine static HTML pages, no build step, no dependencies, no server-side code.
Open one in a browser and it works.

---

## What's in it

### Ledgers — daily practice

| Page | Contents |
|---|---|
| **90-Day Ledger** (`index.html`) | 90 days × Java + System Design + React + DSA. **270 written model answers**, 232 named LeetCode problems, 360 tick-boxes |
| **Platform Ledger** (`platform.html`) | 60 days × AI Engineering + Docker/Kubernetes + AWS. **180 written model answers**, 180 tick-boxes |

Each question comes with a *Must cover* line — the marking scheme — a study
link, and a collapsible model answer written to be spoken aloud in about two
minutes, with follow-up questions an interviewer is likely to ask next.

### Syllabus — the map

**`syllabus.html`** — the same material re-cut by topic instead of by date.
**771 topics across 46 levels in 7 tracks**, each level with a *Done when*
completion criterion and reference links. Use it to work one subject
end-to-end rather than day by day.

### Guides — reference books

Chapter-wise, first principles to interview depth. Read in order, or jump in.

| Book | Chapters |
|---|---|
| **Java Ground Up** (`java.html`) | 56 |
| **System Design Ground Up** (`systemdesign.html`) | 58 |
| **TypeScript & React Ground Up** (`typescript.html`) | 62 |
| **AI Engineering Ground Up** (`ai.html`) | 56 |
| **Docker & Kubernetes Ground Up** (`kubernetes.html`) | 58 |
| **AWS Ground Up** (`aws.html`) | 60 |

**350 chapters.** Each opens with a one-line summary, then explanation, worked
code, principle callouts, and an *Interview angle* note on what an interviewer
is actually testing.

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
- **Navigation** — two dropdowns, *Ledgers* and *Guides*, on every page
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
