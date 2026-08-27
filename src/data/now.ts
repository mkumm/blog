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
		title: 'Penguin Book of Polish Short Stories',
		author: 'Benjamin Paloff (ed.)',
		url: 'https://www.amazon.com/Penguin-Book-Polish-Short-Stories-ebook/dp/B0CW1G1QR5/',
		image: '/now/penguin-polish-short-stories.png',
		note: 'My favorite read of 2025 — still savoring it. As an American in Poland, it gave me real insight into Polish thinking and culture. My Polish partner reluctantly agrees with most of my takeaways.',
		status: 'reading',
		progress: 20,
	},
		{
		title: 'Old Souls',
		author: 'Tom Shroder',
		url: 'https://www.amazon.com/Old-Souls-Compelling-Evidence-Scientific-ebook/dp/B004MME5PS',
		image: '/now/old-souls.png',
		note: 'Explores the narratives of persons that have memories of rather mundane past lives, and the process of collecting and analyzing those accounts.',
		status: 'reading',
		progress: 50,
	},
	{
		title: 'A World Appears',
		author: 'Michael Pollan',
		url: 'https://www.amazon.com/World-Appears-Journey-into-Consciousness-ebook/dp/B0FQMWBPPV',
		image: '/now/a-world-appears.webp',
		note: 'Exploring consciousness. Do we even know what it is yet?',
		status: 'reading',
		progress: 55,
	},
		{
		title: 'Validation',
		author: 'Caroline Fleck',
		url: 'https://www.amazon.com/Validation-Revolutionized-Psychology-Transform-Relationships-ebook',
		image: '/now/validation.webp',
		note: 'A book I needed to read 30 years ago. I did not have awareness on quickly I dismissed other people\'s ideas.',
		status: 'reading',
		progress: 30,
	},


		{
		title: 'I heart logs',
		author: 'Jay Kreps',
		url: 'https://www.amazon.com/Heart-Logs-Stream-Processing-Integration-ebook/dp/B00NUGHIU6',
		image: '/now/i-heart-logs.png',
		note: "Quick read and sets the stage for Kafka",
		status: 'finished',
			progress: 100,
		rating: 5
	},
	{
		title: 'Bird by Bird',
		author: 'Anne Lamott',
		url: 'https://www.amazon.com/Bird-Bird-Some-Instructions-Writing/dp/0679435204',
		image: '/now/bird-by-bird.png',
		note: "Finally getting around to reading this classic. Fits well with my ongoing zen aspirations",
		status: 'reading',
		progress: 50,
	},
	{
		title: 'Cursed Bunny',
		author: 'Bora Chung',
		url: 'https://www.amazon.com/Cursed-Bunny-Bora-Chung-ebook/dp/B0CLL1MSS1',
		image: '/now/cursed-bunny.png',
		note: 'A great collection of short stories — think Black Mirror in book form.',
		status: 'finished',
		progress: 100,
		rating: 4,
	},
	{
		title: 'Greenlights',
		author: 'Matthew McConaughey',
		url: 'https://www.amazon.com/Greenlights-Matthew-McConaughey/dp/0593139135',
		image: '/now/greenlights.png',
		note: 'Far more entertaining than I was expecting.',
		status: 'finished',
		progress: 100,
		rating: 4,
	},
	{
		title: 'Polostan',
		author: 'Neal Stephenson',
		url: 'https://www.amazon.com/Polostan-One-Bomb-Light/dp/0062334492',
		image: '/now/polostan.png',
		note: 'Give me anything Neal Stephenson.',
		status: 'finished',
		progress: 100,
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
		title: 'Lofi Girl - beats to relax/study to',
		artist: 'Mixed',
		url: 'https://open.spotify.com/playlist/0vvXsWCC9xrXsKd4FyS8kM?si=154e91dd415b4acd',
		image: '/now/lofi.png',
	},
	{
		title: 'Emmylou Harris (Compilation)',
		artist: 'Emmylou Harris',
		url: 'https://open.spotify.com/playlist/37i9dQZF1DZ06evO3cY1Lq?si=b2555dc13e084a84',
		image: '/now/emmylou-harris.png',
	},
];
