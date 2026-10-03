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
			status: z.enum(['Active', 'Experiment', 'Archived', 'Just for fun']),
			// Controls listing order on /projects/, lowest first.
			order: z.number().default(99),
		}),
});

const labs = defineCollection({
	// Load Markdown and MDX files in the `src/content/labs/` directory.
	loader: glob({ base: './src/content/labs', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		// Short name of the subject, shown large on the lab's cover (e.g. "grep").
		topic: z.string(),
		level: z.enum(['Beginner', 'Intermediate', 'Advanced']),
		// Minutes the lab takes to work through.
		duration: z.number().default(45),
		audience: z.string(),
		// Where the reader starts, and what they can do by the end.
		levelFrom: z.string(),
		levelTo: z.string(),
	}),
});

export const collections = { writing, projects, labs };
