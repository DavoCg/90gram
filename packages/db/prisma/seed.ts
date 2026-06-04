// Seed a handful of records so the app works without running the scraper.
// previewUrl points at real, reachable audio so the audio slice has something to
// decode and play. source = "seed" keeps these distinct from scraped rows.
import { loadRootEnv } from '../load-root-env.js';

loadRootEnv();

const { prisma } = await import('../src/index.js');

type SeedRecord = {
  externalId: string;
  title: string;
  artist: string;
  year: number;
  coverArtUrl: string;
  previewUrl: string;
  price: number;
  currency: string;
  availability: string;
};

const SEED_RECORDS: SeedRecord[] = [
  {
    externalId: 'seed-001',
    title: 'Midnight Grooves',
    artist: 'The Turntables',
    year: 1979,
    coverArtUrl: 'https://picsum.photos/seed/midnight/600/600',
    previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    price: 24.99,
    currency: 'USD',
    availability: 'in_stock',
  },
  {
    externalId: 'seed-002',
    title: 'Analog Dreams',
    artist: 'Wax & Wane',
    year: 1983,
    coverArtUrl: 'https://picsum.photos/seed/analog/600/600',
    previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    price: 31.5,
    currency: 'USD',
    availability: 'in_stock',
  },
  {
    externalId: 'seed-003',
    title: 'Crackle & Pop',
    artist: 'Groove Merchants',
    year: 1991,
    coverArtUrl: 'https://picsum.photos/seed/crackle/600/600',
    previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    price: 18.0,
    currency: 'USD',
    availability: 'in_stock',
  },
  {
    externalId: 'seed-004',
    title: 'Deep Cuts Vol. 1',
    artist: 'Needle Drop',
    year: 2001,
    coverArtUrl: 'https://picsum.photos/seed/deepcuts/600/600',
    previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    price: 27.75,
    currency: 'USD',
    availability: 'preorder',
  },
  {
    externalId: 'seed-005',
    title: 'Spin City',
    artist: '33 1/3',
    year: 1975,
    coverArtUrl: 'https://picsum.photos/seed/spincity/600/600',
    previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    price: 42.0,
    currency: 'USD',
    availability: 'in_stock',
  },
  {
    externalId: 'seed-006',
    title: 'B-Side Stories',
    artist: 'The Flipsides',
    year: 1988,
    coverArtUrl: 'https://picsum.photos/seed/bside/600/600',
    previewUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    price: 22.25,
    currency: 'USD',
    availability: 'out_of_stock',
  },
];

async function main(): Promise<void> {
  for (const record of SEED_RECORDS) {
    await prisma.record.upsert({
      where: { source_externalId: { source: 'seed', externalId: record.externalId } },
      create: {
        ...record,
        source: 'seed',
        sourceUrl: `https://example.com/records/${record.externalId}`,
        scrapedAt: new Date(),
      },
      update: {
        ...record,
        sourceUrl: `https://example.com/records/${record.externalId}`,
        scrapedAt: new Date(),
      },
    });
  }
  const count = await prisma.record.count();
  console.log(`Seed complete. ${count} record(s) in the database.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
