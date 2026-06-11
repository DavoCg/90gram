import { Prisma, prisma } from '@getvinyls/db';
import { env } from '../env.js';
import { getMeiliClient, VINYLS_INDEX, type VinylDocument } from '../meili.js';

// Rebuild the Meilisearch vinyls index from Postgres.
//
// The index is a DERIVED, secondary view of the canonical `Vinyl` rows: Prisma stays the sole owner
// of the schema, this job only READS and projects rows into search documents. It is idempotent and
// additive: each document upserts by its `id` (the canonical vinyl id), so a rerun refreshes every
// record in place. Vinyls are upserted (never deleted) by the scraper, so stale-document removal is
// out of scope here; a future swap-index rebuild can add it.
//
// It also normalizes each vinyl's cheapest price into a single base (EUR) so the index has one
// comparable, sortable price across mixed-currency offers. That figure is for ranking/filtering
// only; the price the app DISPLAYS is always computed from the DB in the user's currency at query
// time (see apps/api currency middleware).

// Search relevance is weighted by attribute order: artist and title matter most, track titles and
// genres least. Filtering and sorting attributes must be declared up front for Meilisearch to build
// the needed data structures. `shopCount:desc` is appended as a custom ranking rule so that among
// equally relevant matches, records carried by more shops lead (mirrors the home feed's ranking).
const SEARCHABLE_ATTRIBUTES = [
  'artist',
  'title',
  'label',
  'catalogNumber',
  'trackTitles',
  'genres',
];
const FILTERABLE_ATTRIBUTES = ['genreSlugs', 'format', 'year', 'hasOffers'];
const SORTABLE_ATTRIBUTES = ['shopCount', 'year', 'lowestPriceEur', 'createdAtTimestamp'];
const RANKING_RULES = [
  'words',
  'typo',
  'proximity',
  'attribute',
  'sort',
  'exactness',
  'shopCount:desc',
];

// What the reindex query loads per vinyl. Declared once so the row type and the mapper stay in
// lockstep. Only validated genres are indexed, matching what the public API exposes.
const reindexInclude = {
  genres: { where: { genre: { validated: true } }, include: { genre: true } },
  tracks: { select: { title: true } },
  shopVinyls: {
    select: { shopId: true, offers: { select: { currentPrice: true, currentCurrency: true } } },
  },
} satisfies Prisma.VinylInclude;

type ReindexRow = Prisma.VinylGetPayload<{ include: typeof reindexInclude }>;

// Units of each currency per 1 EUR (EUR = 1), the Frankfurter convention. Null when rates could not
// be fetched, in which case prices stay unconverted (lowestPriceEur is left null).
type EurRates = Record<string, number>;

async function fetchEurRates(): Promise<EurRates | null> {
  try {
    const res = await fetch(`${env.FRANKFURTER_BASE_URL}/latest?base=EUR`);
    if (!res.ok) {
      console.warn(
        `[reindex-vinyls] Frankfurter responded ${res.status}; skipping price normalization`,
      );
      return null;
    }
    const body = (await res.json()) as { rates: Record<string, number> };
    return { ...body.rates, EUR: 1 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[reindex-vinyls] failed to fetch exchange rates: ${message}`);
    return null;
  }
}

// Convert an amount into EUR using EUR-based rates (amount / units-per-EUR). Returns null for an
// unknown/absent currency, so an unconvertible offer is skipped rather than mis-ranked.
function toEur(amount: number, currency: string | null, rates: EurRates | null): number | null {
  if (currency === null) return null;
  if (currency === 'EUR') return amount;
  const rate = rates?.[currency];
  if (rate === undefined || rate <= 0) return null;
  return amount / rate;
}

// Project a canonical vinyl (with its relations) into a flat search document.
function toDocument(row: ReindexRow, rates: EurRates | null): VinylDocument {
  const shopIds = new Set<string>();
  let lowestPriceEur: number | null = null;
  let hasOffers = false;
  for (const shopVinyl of row.shopVinyls) {
    shopIds.add(shopVinyl.shopId);
    for (const offer of shopVinyl.offers) {
      hasOffers = true;
      if (offer.currentPrice === null) continue;
      const eur = toEur(Number(offer.currentPrice), offer.currentCurrency, rates);
      if (eur === null) continue;
      if (lowestPriceEur === null || eur < lowestPriceEur) lowestPriceEur = eur;
    }
  }
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    year: row.year,
    label: row.label,
    catalogNumber: row.catalogNumber,
    format: row.format,
    genres: row.genres.map((vg) => vg.genre.name),
    genreSlugs: row.genres.map((vg) => vg.genre.slug),
    trackTitles: row.tracks.map((track) => track.title),
    shopCount: shopIds.size,
    hasOffers,
    lowestPriceEur: lowestPriceEur === null ? null : Math.round(lowestPriceEur * 100) / 100,
    createdAtTimestamp: row.createdAt.getTime(),
  };
}

export async function runReindexVinyls(): Promise<void> {
  const client = getMeiliClient();
  if (client === null) {
    console.log('[reindex-vinyls] MEILI_HOST not set; skipping (search not configured)');
    return;
  }

  const index = client.index<VinylDocument>(VINYLS_INDEX);

  // Ensure the index exists with `id` as its primary key, then (idempotently) apply settings. The
  // create is a no-op after the first run; any error other than "already exists" is fatal.
  try {
    await client.createIndex(VINYLS_INDEX, { primaryKey: 'id' });
  } catch (error) {
    const code = error instanceof Error ? (error as { code?: string }).code : undefined;
    if (code !== 'index_already_exists') throw error;
  }
  await index.updateSettings({
    searchableAttributes: SEARCHABLE_ATTRIBUTES,
    filterableAttributes: FILTERABLE_ATTRIBUTES,
    sortableAttributes: SORTABLE_ATTRIBUTES,
    rankingRules: RANKING_RULES,
  });

  const rates = await fetchEurRates();

  let cursor: string | undefined;
  let indexed = 0;
  for (;;) {
    const rows = await prisma.vinyl.findMany({
      orderBy: { id: 'asc' },
      take: env.JOB_BATCH_SIZE,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
      include: reindexInclude,
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1]?.id;

    const documents = rows.map((row) => toDocument(row, rates));
    await index.addDocuments(documents, { primaryKey: 'id' });
    indexed += documents.length;
    console.log(`[reindex-vinyls] progress: indexed=${indexed}`);
  }

  console.log(`[reindex-vinyls] done: indexed=${indexed}`);
}
