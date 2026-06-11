// The resource registry: one entry per Prisma model the admin can browse. This file is client-safe
// (no Prisma import) so the sidebar, list, and detail UIs can read labels/columns. The actual
// querying lives in db-queries.ts, which maps `model` to the Prisma delegate of the same name.
export interface ResourceDef {
  // URL slug, e.g. "shop-vinyls".
  key: string;
  // Human label for nav and headings.
  label: string;
  // Prisma client delegate property, e.g. "shopVinyl" for prisma.shopVinyl.
  model: string;
  // Fields shown as columns in the list table (also the order they appear).
  columns: string[];
  // String fields searched (case-insensitive contains) by the list `q` param.
  searchFields: string[];
  // Unique field used to look up a single row for the detail page.
  idField: string;
  // Whether rows link to a detail page (false for composite-key join tables).
  hasDetail: boolean;
  // Stable ordering for pagination.
  orderBy: Record<string, 'asc' | 'desc'>;
}

export const RESOURCES: ResourceDef[] = [
  {
    key: 'vinyls',
    label: 'Vinyls',
    model: 'vinyl',
    columns: ['id', 'title', 'artist', 'year', 'label', 'catalogNumber'],
    searchFields: ['title', 'artist', 'catalogNumber', 'label'],
    idField: 'id',
    hasDetail: true,
    orderBy: { createdAt: 'desc' },
  },
  {
    key: 'shops',
    label: 'Shops',
    model: 'shop',
    columns: ['id', 'slug', 'name', 'country', 'baseUrl'],
    searchFields: ['slug', 'name', 'country'],
    idField: 'id',
    hasDetail: true,
    orderBy: { createdAt: 'desc' },
  },
  {
    key: 'shop-vinyls',
    label: 'Shop vinyls',
    model: 'shopVinyl',
    columns: ['id', 'source', 'externalId', 'vinylId', 'shopId', 'rawTitle'],
    searchFields: ['source', 'externalId', 'rawTitle', 'rawArtist'],
    idField: 'id',
    hasDetail: true,
    orderBy: { createdAt: 'desc' },
  },
  {
    key: 'offers',
    label: 'Offers',
    model: 'offer',
    columns: ['id', 'source', 'stockStatus', 'condition', 'currentPrice', 'currentCurrency'],
    searchFields: ['source', 'externalId', 'condition'],
    idField: 'id',
    hasDetail: true,
    orderBy: { createdAt: 'desc' },
  },
  {
    key: 'prices',
    label: 'Prices',
    model: 'price',
    columns: ['id', 'offerId', 'amount', 'currency', 'observedAt'],
    searchFields: ['currency'],
    idField: 'id',
    hasDetail: true,
    orderBy: { observedAt: 'desc' },
  },
  {
    key: 'tracks',
    label: 'Tracks',
    model: 'track',
    columns: ['id', 'position', 'title', 'durationSeconds', 'shopVinylId', 'vinylId'],
    searchFields: ['title', 'position'],
    idField: 'id',
    hasDetail: true,
    orderBy: { createdAt: 'desc' },
  },
  {
    key: 'genres',
    label: 'Genres',
    model: 'genre',
    columns: ['id', 'name', 'slug'],
    searchFields: ['name', 'slug'],
    idField: 'id',
    hasDetail: true,
    orderBy: { name: 'asc' },
  },
  {
    key: 'vinyl-genres',
    label: 'Vinyl genres',
    model: 'vinylGenre',
    columns: ['vinylId', 'genreId'],
    searchFields: [],
    idField: 'vinylId',
    hasDetail: false,
    orderBy: { vinylId: 'asc' },
  },
  {
    key: 'favorites',
    label: 'Favorites',
    model: 'favorite',
    columns: ['id', 'userId', 'vinylId', 'trackId', 'createdAt'],
    searchFields: ['userId'],
    idField: 'id',
    hasDetail: true,
    orderBy: { createdAt: 'desc' },
  },
  {
    key: 'users',
    label: 'Users',
    model: 'user',
    columns: ['id', 'email', 'name', 'role', 'emailVerified', 'createdAt'],
    searchFields: ['email', 'name', 'role'],
    idField: 'id',
    hasDetail: true,
    orderBy: { createdAt: 'desc' },
  },
  {
    key: 'user-settings',
    label: 'User settings',
    model: 'userSetting',
    columns: ['userId', 'currency', 'createdAt'],
    searchFields: ['currency'],
    idField: 'userId',
    hasDetail: true,
    orderBy: { createdAt: 'desc' },
  },
  {
    key: 'sessions',
    label: 'Sessions',
    model: 'session',
    columns: ['id', 'userId', 'ipAddress', 'userAgent', 'expiresAt'],
    searchFields: ['userId', 'ipAddress'],
    idField: 'id',
    hasDetail: true,
    orderBy: { createdAt: 'desc' },
  },
  {
    key: 'accounts',
    label: 'Accounts',
    model: 'account',
    columns: ['id', 'userId', 'providerId', 'accountId'],
    searchFields: ['userId', 'providerId'],
    idField: 'id',
    hasDetail: true,
    orderBy: { createdAt: 'desc' },
  },
  {
    key: 'verifications',
    label: 'Verifications',
    model: 'verification',
    columns: ['id', 'identifier', 'expiresAt', 'createdAt'],
    searchFields: ['identifier'],
    idField: 'id',
    hasDetail: true,
    orderBy: { createdAt: 'desc' },
  },
];

export const RESOURCE_MAP: Record<string, ResourceDef> = Object.fromEntries(
  RESOURCES.map((r) => [r.key, r]),
);

export function getResourceDef(key: string): ResourceDef | undefined {
  return RESOURCE_MAP[key];
}
