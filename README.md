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



## The drawer



## Editing the catalog



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
