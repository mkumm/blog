export interface Book {
	title: string;
	author?: string;
	url: string;
	image: string;
	note?: string;
	status: 'reading' | 'finished';
	progress?: number;  // 0–100, reading only
	rating?: number;    // 0–5 in 0.5 increments, finished only
}

export interface Album {
	title: string;
	artist: string;
	url: string;
	image: string;
}

export const books: Book[] = [
	{
		title: 'Crafting Interpreters',
		author: 'Robert Nystrom',
		url: 'https://craftinginterpreters.com/',
		image: '/now/crafting-interpreters.png',
		note: 'As a functional programmer for the last 6 years, I have lost any imperative/OO instincts. Hoping to go down some rabbit holes working through this book.',
		status: 'reading',
		progress: 2,
	},
	{
		title: 'Penguin Book of Polish Short Stories',
		author: 'Benjamin Paloff (ed.)',
		url: 'https://www.amazon.com/Penguin-Book-Polish-Short-Stories-ebook/dp/B0CW1G1QR5/',
		image: '/now/penguin-polish-short-stories.png',
		note: 'My favorite read of 2025 — still savoring it. As an American in Poland, it gave me real insight into Polish thinking and culture. My Polish partner reluctantly agrees with most of my takeaways.',
		status: 'reading',
		progress: 20,
	},
	{
		title: 'On the Edge: The Art of Risking Everything',
		url: 'https://www.amazon.com/Edge-Art-Risking-Everything/dp/1594204128',
		image: '/now/on-the-edge.png',
		note: "Really enjoying every page so far. Feels much more like a guilty pleasure than a book on stats.",
		status: 'reading',
		progress: 20,
	},
	{
		title: 'Overcoming Binge Eating',
		author: 'Dr. Christopher G Fairburn',
		url: 'https://www.amazon.com/Overcoming-Binge-Eating-Second-Program/dp/1572305614',
		image: '/now/overcoming-binge-eating.png',
		note: "The first half was brutally slow - second half is picking up",
		status: 'reading',
		progress: 55,
	},
		{
		title: 'I heart logs',
		author: 'Jay Kreps',
		url: 'https://www.amazon.com/Heart-Logs-Stream-Processing-Integration-ebook/dp/B00NUGHIU6',
		image: '/now/i-heart-logs.png',
		note: "Opening my mind to Kafka",
		status: 'reading',
		progress: 65,
	},
	{
		title: 'Bird by Bird',
		author: 'Anne Lamott',
		url: 'https://www.amazon.com/Bird-Bird-Some-Instructions-Writing/dp/0679435204',
		image: '/now/bird-by-bird.png',
		note: "Finally getting around to reading this classic. Fits well with my ongoing zen aspirations",
		status: 'reading',
		progress: 60,
	},
	{
		title: 'Cursed Bunny',
		author: 'Bora Chung',
		url: 'https://www.amazon.com/Cursed-Bunny-Bora-Chung-ebook/dp/B0CLL1MSS1',
		image: '/now/cursed-bunny.png',
		note: 'A great collection of short stories — think Black Mirror in book form.',
		status: 'finished',
		rating: 4,
	},
	{
		title: 'Greenlights',
		author: 'Matthew McConaughey',
		url: 'https://www.amazon.com/Greenlights-Matthew-McConaughey/dp/0593139135',
		image: '/now/greenlights.png',
		note: 'Far more entertaining than I was expecting.',
		status: 'finished',
		rating: 4,
	},
	{
		title: 'Polostan',
		author: 'Neal Stephenson',
		url: 'https://www.amazon.com/Polostan-One-Bomb-Light/dp/0062334492',
		image: '/now/polostan.png',
		note: 'Give me anything Neal Stephenson.',
		status: 'finished',
		rating: 4.5,
	},
];

export const albums: Album[] = [
	{
		title: 'Goldberg Variations',
		artist: 'Lang Lang',
		url: 'https://open.spotify.com/playlist/4fC03AYhutXbLhxtv6zkB6',
		image: '/now/goldberg-variations.png',
	},
	{
		title: 'Vinyl Confessions',
		artist: 'Kansas',
		url: 'https://open.spotify.com/album/31kDP6XF3s8dIt0iGFS4PX',
		image: '/now/vinyl-confessions.png',
	},
	{
		title: 'Lazaretto',
		artist: 'Jack White',
		url: 'https://open.spotify.com/album/36LXzRarDP8TU8K0REGpt6',
		image: '/now/lazaretto.png',
	},
];
