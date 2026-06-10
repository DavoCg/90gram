// Stable, centralized query keys so cache reads/writes line up across the app.
export const queryKeys = {
  vinyls: {
    // The home feed, cursor-paginated (an infinite query).
    list: ['vinyls', 'list'] as const,
    detail: (id: string) => ['vinyls', id] as const,
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
  // The signed-in user's settings (display currency today).
  settings: ['settings'] as const,
  // The supported display currencies (drives the picker; rarely changes).
  currencies: ['currencies'] as const,
};
