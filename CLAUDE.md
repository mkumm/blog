# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server at localhost:4321
npm run build     # Build production site to ./dist/
npm run preview   # Preview production build locally
npm run astro     # Run Astro CLI commands
```

There are no test or lint commands configured.

## Architecture

This is a personal blog built with **Astro 5** (static site generator), **Tailwind CSS 4**, and **MDX** for content. It deploys to Netlify at `https://mkumm.com`.

### Content Collections

Content lives in `src/content/` and is defined by schemas in `src/content.config.ts`:

- **`writing/`** — Long-form articles (MDX), collection name `writing`. URL: `/writing/[slug]/`
- **`shorts/`** — Short-form posts (MDX), named `YYYYMMDD[a-z]-slug.mdx`. URL: `/shorts/[slug]/`
- **`profiles/`** — Profile data

All posts share the same frontmatter schema: `title`, `description`, `pubDate`, `updatedDate` (optional), `heroImage` (optional). The `writing` collection additionally supports `tags` (optional string array) — tagged posts get a `/writing/tags/[tag]/` archive page (`src/pages/writing/tags/[tag].astro`), generated for every tag actually in use.

`/blog/*` permanently redirects to `/writing/*` in `netlify.toml` (the section used to be called "Blog").

### Projects

`/projects/` is a hand-written listing page (`src/pages/projects/index.astro`, not a content collection) linking to individual hand-written project pages (`src/pages/projects/<slug>/index.astro`), each built with the shared `src/layouts/ProjectLayout.astro` shell (hero image, tagline, live-site/play link, optional link back to a related `/writing/` post, freeform body via slot).

### Routing

Dynamic routes use `[...slug].astro` in `src/pages/writing/` and `src/pages/shorts/`. `ShortsPost.astro` layout includes prev/next navigation between shorts posts. Reading time is calculated in each `[...slug].astro` from `post.body` (200 wpm) and passed as a prop to the layout.

### Styling

Global styles in `src/styles/global.css` use CSS custom properties for theming:
- Warm/earthy accent `#c17456` (terracotta)
- Cream backgrounds (`--bg-primary: #faf7f3`)
- **Lora** (Google Fonts, serif) for headings, **Atkinson** (local) for body text
- Dark mode via `@media (prefers-color-scheme: dark)` — all colors are CSS variables, no hardcoded values in components
- Tailwind 4 is imported via `@import` at the top of `global.css`

The header background uses `--header-bg` / `--header-bg-solid` CSS variables so dark mode applies automatically.

### Pages

- **`/`** — Homepage with hero image, profile photo (`/profiles/mkumm.png`) in a two-column intro block, plus a featured-posts section (lead card + smaller cards) driven by `FEATURED_POSTS` in `src/consts.ts`
- **`/writing`** — 2-col card grid with hero images (formerly `/blog`)
- **`/projects`** — 3-col card grid linking to hand-written project pages
- **`/shorts`** — 3-col card grid (→ 2-col tablet, → 1-col mobile) with hero images
- **`/now`** — Standalone page matching the writing/shorts listing header style (left-aligned h1, subtitle, border-bottom)

### Constants

Site-wide title and description are in `src/consts.ts`. SEO metadata, OpenGraph tags, and JSON-LD structured data are handled in `src/components/BaseHead.astro`.

### Redirects

`netlify.toml` has permanent redirects: `/posts/*` and `/writings/*` → `/writing/:splat`, and `/blog/*` → `/writing/:splat`.
