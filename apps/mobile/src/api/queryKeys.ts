// Stable, centralized query keys so cache reads/writes line up across the app.
export const queryKeys = {
  vinyls: {
    // The home feed, cursor-paginated (an infinite query). Keyed by the active genre filter (sorted
    // slugs) so each filter combination caches independently; no filter == the base ['vinyls','list'].
    list: (genreSlugs: readonly string[] = []) =>
      ['vinyls', 'list', ...[...genreSlugs].sort()] as const,
    // Prefix matching every home-feed cache regardless of filter (e.g. to seed the detail sheet from
    // whichever filtered feed the vinyl was opened from).
    listAll: ['vinyls', 'list'] as const,
    detail: (id: string) => ['vinyls', id] as const,
    // Full-text search results for a query, cursor-paginated (an infinite query).
    search: (query: string) => ['vinyls', 'search', query] as const,
    // Prefix matching every per-query search cache: a partial key for scanning all loaded search
    // results (e.g. to seed the detail sheet from whichever search the vinyl was opened from).
    searchAll: ['vinyls', 'search'] as const,
  },
  shops: {
    detail: (id: string) => ['shops', id] as const,
    // A shop's vinyls, cursor-paginated (an infinite query).
    vinyls: (id: string) => ['shops', id, 'vinyls'] as const,
  },
  favorites: {
    // The ids of favorited targets: drives the heart state everywhere.
    ids: ['favorites', 'ids'] as const,
    // The favorited vinyls, cursor-paginated (an infinite query).
    vinyls: ['favorites', 'vinyls'] as const,
    // The favorited tracks (not paginated: tracks are not a vinyls list).
    tracks: ['favorites', 'tracks'] as const,
  },
  // The validated genres (drives the home filter sheet; rarely changes).
  genres: ['genres'] as const,
  // The signed-in user's settings (display currency today).
  settings: ['settings'] as const,
  // The supported display currencies (drives the picker; rarely changes).
  currencies: ['currencies'] as const,
  // The signed-in user's own social profile (drives the onboarding gate + the profile tab).
  profile: ['profile'] as const,
  // Live username-availability check for the onboarding field, keyed by the typed handle.
  usernameAvailable: (username: string) => ['username-available', username] as const,
  // Other users (public profiles + their content), keyed by username.
  users: {
    detail: (username: string) => ['users', username] as const,
    followers: (username: string) => ['users', username, 'followers'] as const,
    following: (username: string) => ['users', username, 'following'] as const,
    favorites: (username: string) => ['users', username, 'favorites'] as const,
    collections: (username: string) => ['users', username, 'collections'] as const,
  },
  // Saved groups (collections).
  collections: {
    // The signed-in user's own collections.
    mine: ['collections', 'mine'] as const,
    detail: (id: string) => ['collections', id] as const,
    // A collection's vinyls, cursor-paginated (an infinite query).
    vinyls: (id: string) => ['collections', id, 'vinyls'] as const,
    // Which of my collections contain a given vinyl (drives the add-to-collection sheet).
    memberships: (vinylId: string) => ['collections', 'memberships', vinylId] as const,
  },
};
