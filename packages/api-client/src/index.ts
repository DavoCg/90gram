// Framework-agnostic typed API client. NO React, no react-query: those live in apps/mobile.
// This package exports the generated path types and an openapi-fetch client created against them.
import createClient, { type Client } from 'openapi-fetch';
import type { paths, components } from './schema';

export type ApiClient = Client<paths>;

export type CreateApiClientOptions = {
  /** Base URL of the getvinyls API, e.g. http://127.0.0.1:8787 */
  baseUrl: string;
  /** Optional fetch override (defaults to the global fetch). */
  fetch?: typeof fetch;
};

/** Create a typed openapi-fetch client. Callers supply the base URL from their own env. */
export function createApiClient({ baseUrl, fetch: customFetch }: CreateApiClientOptions): ApiClient {
  return createClient<paths>({ baseUrl, fetch: customFetch });
}

// Convenience type aliases derived from the generated schema (zero hand-written shapes).
export type RecordDto = components['schemas']['Record'];
export type RecordListDto = components['schemas']['RecordList'];

export type { paths, components } from './schema';
