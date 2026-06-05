// Seed a handful of vinyls so the app works without running the scraper. Each vinyl gets a
// few tracks whose previewUrl points at real, reachable audio (the audio slice needs
// something to decode and play), one Offer at a seed shop with a current price + one Price
// history row, and one or more Genres linked through VinylGenre. catalogSource = "seed" keeps
// these distinct from scraped rows. Re-running is idempotent (upsert on the catalog key).
import { loadRootEnv } from '../load-root-env.js';

loadRootEnv();

const { prisma } = await import('../src/index.js');

const SOUNDHELIX = (n: number): string =>
  `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`;

type SeedTrack = { position: string; title: string; durationSeconds: number; song: number };

type SeedVinyl = {
  catalogId: string;
  title: string;
  artist: string;
  year: number;
  coverArtUrl: string;
  label: string;
  catalogNumber: string;
  format: string;
  genres: string[];
  price: number;
  currency: string;
  stockStatus: 'in_stock' | 'out_of_stock' | 'preorder' | 'unknown';
  tracks: SeedTrack[];
};

const SEED_SHOP = {
  slug: 'seed-shop',
  name: 'Seed Records',
  baseUrl: 'https://example.com',
  country: 'FR',
};

const SEED_VINYLS: SeedVinyl[] = [
  {
    catalogId: 'seed-001',
    title: 'Midnight Grooves',
    artist: 'The Turntables',
    year: 1979,
    coverArtUrl: 'https://picsum.photos/seed/midnight/600/600',
    label: 'Groove Records',
    catalogNumber: 'GR-001',
    format: 'LP',
    genres: ['Disco', 'Funk'],
    price: 24.99,
    currency: 'EUR',
    stockStatus: 'in_stock',
    tracks: [
      { position: 'A1', title: 'Night Drive', durationSeconds: 254, song: 1 },
      { position: 'A2', title: 'Neon Lights', durationSeconds: 232, song: 2 },
      { position: 'B1', title: 'After Hours', durationSeconds: 198, song: 3 },
    ],
  },
  {
    catalogId: 'seed-002',
    title: 'Analog Dreams',
    artist: 'Wax & Wane',
    year: 1983,
    coverArtUrl: 'https://picsum.photos/seed/analog/600/600',
    label: 'Vinyl Co',
    catalogNumber: 'VC-014',
    format: 'LP',
    genres: ['Synth-pop'],
    price: 31.5,
    currency: 'EUR',
    stockStatus: 'in_stock',
    tracks: [
      { position: 'A1', title: 'Tape Hiss', durationSeconds: 211, song: 4 },
      { position: 'A2', title: 'Reel to Reel', durationSeconds: 245, song: 5 },
    ],
  },
  {
    catalogId: 'seed-003',
    title: 'Crackle & Pop',
    artist: 'Groove Merchants',
    year: 1991,
    coverArtUrl: 'https://picsum.photos/seed/crackle/600/600',
    label: 'Spin Sounds',
    catalogNumber: 'SS-203',
    format: '12"',
    genres: ['House'],
    price: 18.0,
    currency: 'EUR',
    stockStatus: 'in_stock',
    tracks: [
      { position: 'A1', title: 'First Press', durationSeconds: 320, song: 6 },
      { position: 'B1', title: 'Static', durationSeconds: 288, song: 7 },
    ],
  },
  {
    catalogId: 'seed-004',
    title: 'Deep Cuts Vol. 1',
    artist: 'Needle Drop',
    year: 2001,
    coverArtUrl: 'https://picsum.photos/seed/deepcuts/600/600',
    label: 'Crate Diggers',
    catalogNumber: 'CD-007',
    format: 'LP',
    genres: ['Jazz', 'Soul'],
    price: 27.75,
    currency: 'EUR',
    stockStatus: 'preorder',
    tracks: [
      { position: 'A1', title: 'Side One Opener', durationSeconds: 263, song: 8 },
      { position: 'A2', title: 'Blue Note', durationSeconds: 240, song: 9 },
      { position: 'B1', title: 'Closing Time', durationSeconds: 305, song: 10 },
    ],
  },
  {
    catalogId: 'seed-005',
    title: 'Spin City',
    artist: '33 1/3',
    year: 1975,
    coverArtUrl: 'https://picsum.photos/seed/spincity/600/600',
    label: 'Rotation',
    catalogNumber: 'ROT-033',
    format: 'LP',
    genres: ['Rock'],
    price: 42.0,
    currency: 'EUR',
    stockStatus: 'in_stock',
    tracks: [
      { position: 'A1', title: 'Revolutions', durationSeconds: 276, song: 11 },
      { position: 'B1', title: 'Locked Groove', durationSeconds: 254, song: 12 },
    ],
  },
  {
    catalogId: 'seed-006',
    title: 'B-Side Stories',
    artist: 'The Flipsides',
    year: 1988,
    coverArtUrl: 'https://picsum.photos/seed/bside/600/600',
    label: 'Flip Records',
    catalogNumber: 'FR-088',
    format: '7"',
    genres: ['Pop'],
    price: 22.25,
    currency: 'EUR',
    stockStatus: 'out_of_stock',
    tracks: [
      { position: 'A', title: 'Hit Single', durationSeconds: 198, song: 13 },
      { position: 'B', title: 'Forgotten Gem', durationSeconds: 213, song: 14 },
    ],
  },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main(): Promise<void> {
  const shop = await prisma.shop.upsert({
    where: { slug: SEED_SHOP.slug },
    create: SEED_SHOP,
    update: SEED_SHOP,
  });

  for (const seed of SEED_VINYLS) {
    const now = new Date();

    const vinyl = await prisma.vinyl.upsert({
      where: { catalogSource_catalogId: { catalogSource: 'seed', catalogId: seed.catalogId } },
      create: {
        catalogSource: 'seed',
        catalogId: seed.catalogId,
        title: seed.title,
        artist: seed.artist,
        year: seed.year,
        coverArtUrl: seed.coverArtUrl,
        label: seed.label,
        catalogNumber: seed.catalogNumber,
        format: seed.format,
        tracks: {
          create: seed.tracks.map((t) => ({
            position: t.position,
            title: t.title,
            durationSeconds: t.durationSeconds,
            previewUrl: SOUNDHELIX(t.song),
          })),
        },
        genres: {
          create: seed.genres.map((name) => ({
            genre: {
              connectOrCreate: {
                where: { name },
                create: { name, slug: slugify(name) },
              },
            },
          })),
        },
      },
      update: {
        title: seed.title,
        artist: seed.artist,
        year: seed.year,
        coverArtUrl: seed.coverArtUrl,
        label: seed.label,
        catalogNumber: seed.catalogNumber,
        format: seed.format,
      },
    });

    const offer = await prisma.offer.upsert({
      where: { source_externalId: { source: SEED_SHOP.slug, externalId: seed.catalogId } },
      create: {
        vinylId: vinyl.id,
        shopId: shop.id,
        source: SEED_SHOP.slug,
        externalId: seed.catalogId,
        sourceUrl: `${SEED_SHOP.baseUrl}/records/${seed.catalogId}`,
        stockStatus: seed.stockStatus,
        currentPrice: seed.price,
        currentCurrency: seed.currency,
        scrapedAt: now,
        prices: { create: { amount: seed.price, currency: seed.currency, observedAt: now } },
      },
      update: {
        stockStatus: seed.stockStatus,
        currentPrice: seed.price,
        currentCurrency: seed.currency,
        scrapedAt: now,
      },
    });
    void offer;
  }

  const [vinyls, tracks, offers, prices, genres] = await Promise.all([
    prisma.vinyl.count(),
    prisma.track.count(),
    prisma.offer.count(),
    prisma.price.count(),
    prisma.genre.count(),
  ]);
  console.log(
    `Seed complete. ${vinyls} vinyl(s), ${tracks} track(s), ${offers} offer(s), ` +
      `${prices} price(s), ${genres} genre(s).`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
