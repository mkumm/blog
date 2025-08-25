/**
 * Base Tailwind CSS config.
 * Using ESM since package.json has "type": "module".
 * You can extend theme & plugins later.
 *
 * Content globs include Astro components, pages, MD/MDX content, and TS/JS.
 */

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}',
    './public/**/*.html'
  ],
  theme: {
    extend: {
      colors: {
        // Example mapping to existing CSS variable palette (can adjust later)
        accent: 'var(--accent)',
        'accent-dark': 'var(--accent-dark)',
        gray: {
          50: 'rgb(var(--gray-light))',
          500: 'rgb(var(--gray))',
          800: 'rgb(var(--gray-dark))'
        }
      },
      fontFamily: {
        // Make Atkinson available via font-atkinson class
        atkinson: ['Atkinson', 'sans-serif']
      },
      boxShadow: {
        card: 'var(--box-shadow)'
      }
    }
  },
  // Set Atkinson as the default sans so Tailwind preflight picks it up for body/html
  safelist: [],
  corePlugins: {},
  theme: {
    extend: {
      // (extensions above already) duplicated keys merged by Tailwind
    },
    fontFamily: {
      sans: ['Atkinson', 'sans-serif']
    }
  },
  plugins: []
};
