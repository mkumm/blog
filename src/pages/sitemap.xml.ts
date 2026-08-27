import { getCollection } from 'astro:content';
import { BLOG_PAGE_SIZE, SHORTS_PAGE_SIZE } from '../consts';

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
  const blogPosts = await getCollection('blog');
  const shorts = await getCollection('shorts');

  const shortsPageCount = Math.max(1, Math.ceil(shorts.length / SHORTS_PAGE_SIZE));
  const blogPageCount = Math.max(1, Math.ceil(blogPosts.length / BLOG_PAGE_SIZE));

  const staticEntries = [
    urlEntry(`${SITE}/`, undefined, '1.0', 'weekly'),
    urlEntry(`${SITE}/now/`, undefined, '0.7', 'monthly'),
  ];

  const blogIndexEntries = Array.from({ length: blogPageCount }, (_, i) =>
    urlEntry(
      i === 0 ? `${SITE}/blog/` : `${SITE}/blog/${i + 1}/`,
      undefined,
      '0.9',
      'weekly',
    )
  );

  const shortsIndexEntries = Array.from({ length: shortsPageCount }, (_, i) =>
    urlEntry(
      i === 0 ? `${SITE}/shorts/` : `${SITE}/shorts/${i + 1}/`,
      undefined,
      '0.9',
      'weekly',
    )
  );

  const blogEntries = blogPosts.map((post) =>
    urlEntry(
      `${SITE}/blog/${post.id}/`,
      toLastmod(post.data.updatedDate ?? post.data.pubDate),
      '0.8',
      'monthly',
    )
  );

  const shortsEntries = shorts.map((post) =>
    urlEntry(
      `${SITE}/shorts/${post.id}/`,
      toLastmod(post.data.updatedDate ?? post.data.pubDate),
      '0.7',
      'monthly',
    )
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticEntries, ...blogIndexEntries, ...shortsIndexEntries, ...blogEntries, ...shortsEntries].join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
