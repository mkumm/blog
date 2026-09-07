import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const writing = defineCollection({
	// Load Markdown and MDX files in the `src/content/writing/` directory.
	loader: glob({ base: './src/content/writing', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: image().optional(),
			tags: z.array(z.string()).optional(),
		}),
});

const projects = defineCollection({
	// Load Markdown and MDX files in the `src/content/projects/` directory.
	loader: glob({ base: './src/content/projects', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			tagline: z.string(),
			// Use ONE of these: heroImage for a local file (../../assets/... import
			// path), heroImageUrl for a plain https:// URL — both get optimized
			// (resized, converted to webp) the same way.
			heroImage: image().optional(),
			heroImageUrl: z.string().url().optional(),
			liveUrl: z.string(),
			liveLabel: z.string().default('Visit site'),
			writingHref: z.string().optional(),
			// Controls listing order on /projects/, lowest first.
			order: z.number().default(99),
		}),
});

export const collections = { writing, projects };
