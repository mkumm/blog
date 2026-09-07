import { getCollection } from 'astro:content';
import { WRITING_PAGE_SIZE } from '../consts';

const SITE = 'https://mkumm.com';

function toLastmod(date: Date) {
  return date.toISOString().split('T')[0];
}

function urlEntry(loc: string, lastmod?: string, priority = '0.8', changefreq = 'monthly') {
  return [
    '  <url>',
    `    <loc>${loc}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : '',
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].filter(Boolean).join('\n');
}

export async function GET() {
  const writingPosts = await getCollection('writing');
  const projects = await getCollection('projects');

  const writingPageCount = Math.max(1, Math.ceil(writingPosts.length / WRITING_PAGE_SIZE));

  const staticEntries = [
    urlEntry(`${SITE}/`, undefined, '1.0', 'weekly'),
    urlEntry(`${SITE}/projects/`, undefined, '0.8', 'monthly'),
    urlEntry(`${SITE}/about/`, undefined, '0.6', 'yearly'),
    urlEntry(`${SITE}/now/`, undefined, '0.7', 'monthly'),
  ];

  const projectEntries = projects.map((project) =>
    urlEntry(`${SITE}/projects/${project.id}/`, undefined, '0.7', 'monthly')
  );

  const writingIndexEntries = Array.from({ length: writingPageCount }, (_, i) =>
    urlEntry(
      i === 0 ? `${SITE}/writing/` : `${SITE}/writing/${i + 1}/`,
      undefined,
      '0.9',
      'weekly',
    )
  );

  const writingEntries = writingPosts.map((post) =>
    urlEntry(
      `${SITE}/writing/${post.id}/`,
      toLastmod(post.data.updatedDate ?? post.data.pubDate),
      '0.8',
      'monthly',
    )
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticEntries, ...writingIndexEntries, ...writingEntries, ...projectEntries].join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
