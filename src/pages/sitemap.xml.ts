import { getCollection } from 'astro:content';

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

  const staticEntries = [
    urlEntry(`${SITE}/`, undefined, '1.0', 'weekly'),
    urlEntry(`${SITE}/blog/`, undefined, '0.9', 'weekly'),
    urlEntry(`${SITE}/shorts/`, undefined, '0.9', 'weekly'),
    urlEntry(`${SITE}/now/`, undefined, '0.7', 'monthly'),
  ];

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
${[...staticEntries, ...blogEntries, ...shortsEntries].join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
