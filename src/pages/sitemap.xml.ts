import { getCollection } from 'astro:content';

const SITE = 'https://mkumm.com';

const staticRoutes = ['/', '/blog', '/shorts', '/now'];

export async function GET() {
  const blogPosts = await getCollection('blog');
  const shorts = await getCollection('shorts');

  const blogUrls = blogPosts.map((post) => `${SITE}/blog/${post.id}/`);
  const shortUrls = shorts.map((post) => `${SITE}/shorts/${post.id}/`);

  const allUrls = [
    ...staticRoutes.map((r) => `${SITE}${r}`),
    ...blogUrls,
    ...shortUrls,
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}
