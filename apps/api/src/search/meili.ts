import { Meilisearch } from 'meilisearch';
import { env } from '../env.js';

// Read-only Meilisearch access for the search route. The index is built and owned by the jobs
// service (apps/jobs reindex-vinyls); each document is self-contained, so the API returns a hit
// straight as a `VinylSummary` with NO Postgres hydration. The only thing resolved at query time is
// the display currency (the route's converter runs over the document's cheapest price).

// Must match the index name the jobs writer uses.
const VINYLS_INDEX = 'vinyls';

// The retrieved shape of a hit: a read-side mirror of the jobs writer's `VinylDocument`
// (apps/jobs/src/meili.ts). The two apps do not share code (like VINYLS_INDEX, this is duplicated by
// design); keep them in sync. Only the fields the search route reads are declared here.
export interface VinylSearchDocument {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  coverArtUrl: string | null;
  label: string | null;
  format: string | null;
  genres: { id: string; name: string; slug: string }[];
  tracks: {
    id: string;
    position: string;
    title: string;
    durationSeconds: number | null;
    previewUrl: string | null;
  }[];
  shopCount: number;
  // The cheapest offer's ORIGINAL listed price + currency, converted to the display currency by the
  // route. Null when the record has no priced/convertible offer.
  lowestPrice: number | null;
  lowestCurrency: string | null;
}

let client: Meilisearch | null = null;

// True when a search server is configured. The route answers 503 when it is not, rather than the
// API failing to boot, so the rest of the API runs without Meilisearch in local development.
export function isSearchConfigured(): boolean {
  return env.MEILI_HOST !== undefined;
}

function getClient(): Meilisearch | null {
  if (env.MEILI_HOST === undefined) return null;
  client ??= new Meilisearch({ host: env.MEILI_HOST, apiKey: env.MEILI_SEARCH_KEY });
  return client;
}

export interface VinylSearchResult {
  // Matching documents in relevance order (most relevant first), each self-contained.
  documents: VinylSearchDocument[];
  // Meilisearch's estimate of the total number of matches (drives pagination).
  total: number;
}

// Query the vinyls index. Returns null when search is not configured (so the route can answer 503);
// throws when the configured server is unreachable (the route maps that to 503 too). Full documents
// are retrieved so the route renders each hit without touching Postgres.
export async function searchVinyls(
  query: string,
  limit: number,
  offset: number,
): Promise<VinylSearchResult | null> {
  const meili = getClient();
  if (meili === null) return null;
  const res = await meili.index<VinylSearchDocument>(VINYLS_INDEX).search(query, {
    limit,
    offset,
  });
  return { documents: res.hits, total: res.estimatedTotalHits };
}
