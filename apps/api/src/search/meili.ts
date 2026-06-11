import { Meilisearch } from 'meilisearch';
import { env } from '../env.js';

// Read-only Meilisearch access for the search route. The index is built and owned by the jobs
// service (apps/jobs reindex-vinyls); the API only queries it for ranked vinyl ids and then hydrates
// the full response from Postgres, so the wire shape and currency conversion stay in one place.

// Must match the index name the jobs writer uses.
const VINYLS_INDEX = 'vinyls';

// The only field we retrieve from a hit: the canonical vinyl id. Everything else is loaded from the
// database, so the index never needs to mirror the (currency-converted) wire shape.
interface VinylHit {
  id: string;
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
  // Matching vinyl ids in relevance order (most relevant first).
  ids: string[];
  // Meilisearch's estimate of the total number of matches (drives pagination).
  total: number;
}

// Query the vinyls index. Returns null when search is not configured (so the route can answer 503);
// throws when the configured server is unreachable (the route maps that to 503 too).
export async function searchVinylIds(
  query: string,
  limit: number,
  offset: number,
): Promise<VinylSearchResult | null> {
  const meili = getClient();
  if (meili === null) return null;
  const res = await meili.index<VinylHit>(VINYLS_INDEX).search(query, {
    limit,
    offset,
    attributesToRetrieve: ['id'],
  });
  return { ids: res.hits.map((hit) => hit.id), total: res.estimatedTotalHits };
}
