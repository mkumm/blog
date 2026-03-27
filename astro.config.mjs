// @ts-check

import mdx from '@astrojs/mdx';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://mkumm.com',
  trailingSlash: 'always',
  integrations: [mdx()],

  vite: {
    plugins: [tailwindcss()],
  },
});