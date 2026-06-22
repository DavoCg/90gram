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
export type VinylDto = components['schemas']['Vinyl'];
export type VinylSummaryDto = components['schemas']['VinylSummary'];
export type VinylListDto = components['schemas']['VinylList'];
export type TrackDto = components['schemas']['Track'];
export type ShopDto = components['schemas']['Shop'];
export type ShopDetailDto = components['schemas']['ShopDetail'];
export type OfferDto = components['schemas']['Offer'];
export type GenreDto = components['schemas']['Genre'];
export type FavoriteIdsDto = components['schemas']['FavoriteIds'];
export type FavoriteTracksDto = components['schemas']['FavoriteTracks'];
export type FavoriteTrackDto = components['schemas']['FavoriteTrack'];
export type FavoriteTargetType = components['schemas']['FavoriteTargetType'];
export type CreateFavoriteDto = components['schemas']['CreateFavorite'];
export type FavoriteRefDto = components['schemas']['FavoriteRef'];
export type SupportedCurrency = components['schemas']['SupportedCurrency'];
export type CurrencyListDto = components['schemas']['CurrencyList'];
export type SupportedLanguage = components['schemas']['SupportedLanguage'];
export type LanguageListDto = components['schemas']['LanguageList'];
export type UserSettingsDto = components['schemas']['UserSettings'];
export type UpdateUserSettingsDto = components['schemas']['UpdateUserSettings'];

// Social (profiles, follows, collections).
export type MyProfileDto = components['schemas']['MyProfile'];
export type UpdateProfileDto = components['schemas']['UpdateProfile'];
export type ClaimUsernameDto = components['schemas']['ClaimUsername'];
export type UsernameAvailabilityDto = components['schemas']['UsernameAvailability'];
export type PublicUserDto = components['schemas']['PublicUser'];
export type UserSummaryDto = components['schemas']['UserSummary'];
export type UserListDto = components['schemas']['UserList'];
export type CollectionDto = components['schemas']['Collection'];
export type CollectionListDto = components['schemas']['CollectionList'];
export type CreateCollectionDto = components['schemas']['CreateCollection'];
export type UpdateCollectionDto = components['schemas']['UpdateCollection'];
export type CollectionMembershipsDto = components['schemas']['CollectionMemberships'];

export type { paths, components } from './schema';
