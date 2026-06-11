import { Meilisearch } from 'meilisearch';
import { env } from './env.js';

// The name of the vinyls search index. Shared by the writer here (reindex-vinyls) and the API's
// read-only search client. Kept as a constant so the two sides cannot drift on a string literal.
export const VINYLS_INDEX = 'vinyls';

// The shape of one search document: a flattened, search-optimized projection of a canonical Vinyl.
// This is NOT the API wire shape (the API hydrates the full VinylSummary from Postgres after a
// match); the index only needs what drives matching, ranking, filtering, and sorting.
export interface VinylDocument {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  label: string | null;
  catalogNumber: string | null;
  format: string | null;
  // Validated genre names (searchable) and slugs (filterable).
  genres: string[];
  genreSlugs: string[];
  // The reference tracklist's track titles, so a search can match on a track name.
  trackTitles: string[];
  // How many distinct shops list this record (mirrors the home feed's ranking) and whether any
  // shop has a priced offer. Both filterable/sortable.
  shopCount: number;
  hasOffers: boolean;
  // The cheapest current price across all offers, normalized to EUR so it is comparable across
  // mixed-currency offers. Null when no priced offer (or rates were unavailable at index time).
  // Used only for sorting/filtering; the displayed price comes from the DB at query time.
  lowestPriceEur: number | null;
  // createdAt as an epoch millisecond timestamp, so "newest" is a sortable numeric attribute.
  createdAtTimestamp: number;
}

let client: Meilisearch | null = null;

// The Meilisearch client, or null when search is not configured (MEILI_HOST unset). Callers no-op
// on null so the jobs daemon runs without a search server in local development.
export function getMeiliClient(): Meilisearch | null {
  if (env.MEILI_HOST === undefined) return null;
  client ??= new Meilisearch({ host: env.MEILI_HOST, apiKey: env.MEILI_MASTER_KEY });
  return client;
}
