import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_TITLE } from '../../consts';

export async function GET(context) {
	const posts = (await getCollection('shorts')).sort(
		(a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
	);
	return rss({
		title: `${SITE_TITLE} — Shorts`,
		description: 'Quick notes, observations, and things from daily life.',
		site: context.site,
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.pubDate,
			link: `/shorts/${post.id}/`,
			author: 'hello@mkumm.com (Michael Kumm)',
		})),
	});
}
