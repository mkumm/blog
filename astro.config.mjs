// @ts-check

import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

/** @type {import('unified').Plugin} */
function rehypeMermaid() {
  return (tree) => {
    function visit(node) {
      if (node.type === 'element' && node.tagName === 'pre') {
        const code = node.children?.[0];
        if (
          code?.tagName === 'code' &&
          code.properties?.className?.includes('language-mermaid')
        ) {
          node.tagName = 'div';
          node.properties = { className: ['mermaid'] };
          node.children = code.children;
        }
      }
      node.children?.forEach(visit);
    }
    visit(tree);
  };
}

// https://astro.build/config
export default defineConfig({
  site: 'https://mkumm.com',
  trailingSlash: 'always',
  integrations: [mdx()],

  image: {
    // Lets <Image> optimize a plain https:// URL the same way it optimizes
    // a local imported file — resize, convert to webp, generate srcset.
    remotePatterns: [{ protocol: 'https' }],
  },

  markdown: {
    processor: unified({ rehypePlugins: [rehypeMermaid] }),
    syntaxHighlight: {
      type: 'shiki',
      excludeLangs: ['mermaid'],
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },
});