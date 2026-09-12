<p align="center">
  <a href="[https://stackforge.vercel.app](https://github.com/e-mdj7/StackForge)">
    <img src="public/favicon.svg" width="64" height="64" alt="StackForge" />
  </a>
</p>

<h1 align="center">
  StackForge
</h1>

<p align="center">
  <strong>Visual technology-stack builder.</strong><br />
  Drop technologies onto a canvas and it tells you what conflicts, what is missing,
  and what connects to what.
</p>

<p align="center">
  <a href="https://stackforge.vercel.app" target="_blank">
    <img src="https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white" alt="Live demo" />
  </a>
  <a href="#stack">
    <img src="https://img.shields.io/badge/Stack-React%20%7C%20Vite%20%7C%20TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white&labelColor=3178C6&color=black" alt="Stack" />
  </a>
</p>
<p align="center">
  <a href="https://github.com/e-mdj7/StackForge/actions">
    <img src="https://img.shields.io/github/actions/status/e-mdj7/StackForge?logo=github&label=ci" alt="CI" />
  </a>
  <a href="#license">
    <img src="https://img.shields.io/badge/license-MIT-lightgrey?logo=opensourceinitiative" alt="License" />
  </a>
</p>

---

## The canvas

<p align="center">
  <img src="public/icons.svg" alt="StackForge canvas" width="720" />
</p>

Everything is driven by **data, not code**. Each technology is one JSON object in
`src/catalog/<group>.json`:

```json
{
  "id": "supabase",
  "name": "Supabase",
  "group": "backend",
  "section": "Platform (BaaS)",
  "icon": "supabase",
  "color": "#3fcf8e",
  "langs": ["sql", "ts"],
  "desc": "Postgres with auth, storage and realtime on top. Use when you want a BaaS but refuse to give up SQL.",
  "provides": ["db", "db-sql", "auth", "storage", "realtime"],
  "exclusive": ["baas", "auth"],
  "links": [{ "to": "postgresql", "rel": "extends" }]
}
```

From those fields alone, `src/rules.ts` (~90 lines) derives every behaviour:

| Field | What it produces |
|---|---|
| `conflicts` | Hard incompatibility. Firebase lists `postgresql`, so selecting one greys out the other with *"Firebase is not compatible with PostgreSQL"*. Symmetric — declare it once. |
| `exclusive` | Slot contention. Firebase and Supabase both claim `baas`; Vitest and Jest both claim `test-unit`. Pick one. |
| `needs` | Red ring + tooltip when nothing in the stack `provides` that capability, and an arrow to the provider when something does. |
| `links` | Typed arrows, drawn only when both ends are on the canvas. Vitest → Vite is `tests`; Next.js → React is `extends`. Optional `card` sets cardinality (`n-1`, `1-n`, `n-n`), drawn as `1` / `∗` marks at each end. |
| `langs` | The language-family badge on the block and the highlight filter. React is `ts, js, css`; Tailwind is `css`. |
| `provides` | Feeds the stack-wide rules in `catalog/rules.json` — *users with no auth*, *self-hosted API with no database*, *containers with no CI*. |

Group boxes exist only while they hold something: add a tool and its box appears, remove the last one and it disappears. Sections (`Build & Bundler`, `UI & Components`, `Styling`, …) are declared per box in `groups.json`.

**Arrow direction is one promise, everywhere:** the arrow points from the thing that depends on, reads from, or acts on — to the thing it depends on. Next.js → React. Prisma → PostgreSQL. PayPal → the database and the auth provider it needs. Solid lines are runtime dependencies; **dashed** lines are referential (builds on, tests, monitors).

**Click a block** to trace it: its arrows light up with a travelling dot, direct neighbours stay lit, everything else drops to 15%, and the drawer opens on the right. **Hover** puts the description and any problems in the strip along the bottom, so nothing ever covers a neighbouring block. Wires render *under* the blocks for the same reason.

**Removing** is the `×` on any block (or the palette entry, or the drawer). If that block has account details saved on it you get asked first; either way an **Undo** appears for 8 seconds and restores the block with its credentials and position intact.

The **Needed / recommended** panel appears top-right whenever something is missing, naming the capability, who wants it, and offering compatible technologies you can add in one click.

## The drawer

Per-technology console URL, username, password and notes. The password is encrypted in the browser with **AES-GCM (PBKDF2, 310k iterations)** before it touches `localStorage`. The passphrase lives in memory for the session only and is never written anywhere, so a stolen `localStorage` dump is ciphertext. Clear the passphrase and the saved password is unreadable — including by you, so keep it somewhere.

Everything runs locally. There is no server and no network call except brand icons from `cdn.simpleicons.org`.

## Editing the catalog

`entries.md` is the plain-text plan: what is in (349 entries), what is queued. To add a technology, copy a neighbour in the relevant JSON. To add a whole box, add it to `groups.json` with its `sections`, create `<id>.json`, and add two lines to `src/catalog/index.ts`.

`pnpm check` fails loudly on a misspelled section name, a link pointing at a nonexistent id, or a `needs` capability nothing provides.

## Stack

<p id="stack" align="center">
  <picture>
    <img src="https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black" height="20" alt="React" />
    <span style="margin:0 8px;color:#888">+</span>
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" height="20" alt="TypeScript" />
    <span style="margin:0 8px;color:#888">+</span>
    <img src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white" height="20" alt="Vite" />
    <span style="margin:0 8px;color:#888">+</span>
    <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" height="20" alt="Tailwind" />
    <span style="margin:0 8px;color:#888">+</span>
    <img src="https://img.shields.io/badge/Zustand--5-F2C811?style=flat-square&logo=zustand&logoColor=F2C811)" height="20" alt="Zustand" />
    <span style="margin:0 8px;color:#888">+</span>
    <img src="https://img.shields.io/badge/pnpm-F69220?style=flat-square&logo=pnpm&logoColor=white" height="20" alt="pnpm" />
  </picture>
</p>

- **React 19** — UI
- **TypeScript 6** — types (TSC + `experimental-strip-types` for test runs)
- **Vite 8** — dev server + build
- **Tailwind CSS 4** — styling via `@tailwindcss/vite`
- **Zustand 5** — state + `localStorage` persistence
- **@xyflow/react 12** — the canvas / node graph
- **pnpm** — package manager

## Run it

```bash
pnpm install
pnpm dev       # http://localhost:5173
pnpm check     # rule engine + catalog integrity tests
```

## Files

```
src/
  types.ts          the schema every JSON file follows
  rules.ts          conflicts, missing pieces, arrows  (+ rules.test.ts)
  layout.ts         auto-arranges boxes and blocks
  store.ts          zustand + localStorage
  crypto.ts         AES-GCM for the password field
  catalog/          groups.json, rules.json, 15 technology files (+ catalog.test.ts)
  components/
    nodes.tsx       block, group box, floating typed edge
    panels.tsx      palette, top bar, legend, drawer
```

## License

MIT — do what you want with it. See `LICENSE` for the exact text. — <a href="https://github.com/e-mdj7">e-mdj7</a>
