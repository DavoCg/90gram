import { Meilisearch } from 'meilisearch';
import { env } from './env.js';

// The name of the vinyls search index. Shared by the writer here (reindex-vinyls) and the API's
// read-only search client. Kept as a constant so the two sides cannot drift on a string literal.
export const VINYLS_INDEX = 'vinyls';

// The shape of one search document: a self-contained projection of a canonical Vinyl that carries
// everything the search route returns, so a hit renders WITHOUT a Postgres hydration. It holds both
// the fields that drive matching/ranking/filtering/sorting AND the display payload (cover, genres,
// tracks, cheapest price). The API maps a document straight to the `VinylSummary` wire shape; the only
// thing resolved at query time is currency (the converter runs over `lowestPrice`/`lowestCurrency`).
//
// Searchable attributes point at nested paths (`genres.name`, `tracks.title`), so genres and tracks
// are kept as full objects rather than duplicated into separate flat string arrays.
export interface VinylDocument {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  coverArtUrl: string | null;
  label: string | null;
  catalogNumber: string | null;
  format: string | null;
  // Validated genres as full display objects. Searchable on `genres.name`, filterable on `genres.slug`.
  genres: { id: string; name: string; slug: string }[];
  // The reference tracklist, ordered by position. Searchable on `tracks.title`; the rest is display.
  tracks: {
    id: string;
    position: string;
    title: string;
    durationSeconds: number | null;
    previewUrl: string | null;
  }[];
  // How many distinct shops list this record (mirrors the home feed's ranking) and whether any
  // shop has a priced offer. Both filterable/sortable.
  shopCount: number;
  hasOffers: boolean;
  // The cheapest current offer, kept as the shop's ORIGINAL listed price + currency so the API can
  // convert it into the request's display currency at query time. The cheapest pick is currency
  // independent (every offer scales by the same positive rate), so it is chosen once here by comparing
  // in EUR. Null when there is no priced/convertible offer.
  lowestPrice: number | null;
  lowestCurrency: string | null;
  // The same cheapest price normalized to EUR, so "cheapest" is a sortable numeric attribute across
  // mixed-currency offers. Null when no priced offer (or rates were unavailable at index time).
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
