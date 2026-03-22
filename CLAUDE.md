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

- **`blog/`** — Long-form articles (MDX). URL: `/blog/[slug]/`
- **`shorts/`** — Short-form posts (MDX), named `YYYYMMDD[a-z]-slug.mdx`. URL: `/shorts/[slug]/`
- **`profiles/`** — Profile data

All posts share the same frontmatter schema: `title`, `description`, `pubDate`, `updatedDate` (optional), `heroImage` (optional).

### Routing

Dynamic routes use `[...slug].astro` in `src/pages/blog/` and `src/pages/shorts/`. `ShortsPost.astro` layout includes prev/next navigation between shorts posts.

### Styling

Global styles in `src/styles/global.css` use CSS custom properties for theming (warm/earthy accent `#c17456`, cream backgrounds). Tailwind 4 is imported via `@import`. Dark mode is class-based. Custom fonts (Atkinson, DancingScript) are loaded from `public/fonts/`.

### Constants

Site-wide title and description are in `src/consts.ts`. SEO metadata, OpenGraph tags, and JSON-LD structured data are handled in `src/components/BaseHead.astro`.

### Redirects

`netlify.toml` has permanent redirects: `/posts/*` and `/writings/*` → `/blog/:splat`.
