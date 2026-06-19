import { useCallback, useEffect, useRef } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type QueryKey,
  type UseInfiniteQueryResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  FavoriteIdsDto,
  FavoriteTrackDto,
  GenreDto,
  ShopDetailDto,
  VinylDto,
  VinylListDto,
  VinylSummaryDto,
  MyProfileDto,
  UpdateProfileDto,
  UsernameAvailabilityDto,
  PublicUserDto,
  UserSummaryDto,
  UserListDto,
  CollectionDto,
  CreateCollectionDto,
  UpdateCollectionDto,
  CollectionMembershipsDto,
} from '@getvinyls/api-client';
import { apiClient } from './client';
import { queryKeys } from './queryKeys';
import { toast } from '../components/toast';

// react-query hooks wrapping the typed client. These live in the app, not in
// @getvinyls/api-client (which stays React-free). No hand-written fetch, zero any.

// Page size for every cursor-paginated (infinite) vinyls list.
const PAGE_SIZE = 20;

// Flatten the loaded pages of an infinite vinyls query into a single list for rendering.
function flattenVinyls(data: InfiniteData<VinylListDto>): VinylSummaryDto[] {
  return data.pages.flatMap((page) => page.vinyls);
}

// Like flattenVinyls, but dedupes by vinyl id (a shop can list the same canonical vinyl more than
// once, so its paginated listings may repeat a vinyl across pages).
function flattenUniqueVinyls(data: InfiniteData<VinylListDto>): VinylSummaryDto[] {
  const seen = new Set<string>();
  const out: VinylSummaryDto[] = [];
  for (const page of data.pages) {
    for (const vinyl of page.vinyls) {
      if (seen.has(vinyl.id)) continue;
      seen.add(vinyl.id);
      out.push(vinyl);
    }
  }
  return out;
}

// The home feed: every vinyl, cursor-paginated. `data` is the flattened list; pull more with
// fetchNextPage() when the list nears its end (hasNextPage gates whether there is more). Deduped by
// id: /vinyls pages by offset over a shop-count ranking that the scraper mutates, so a vinyl can slip
// across the page boundary and repeat. A duplicate id is a duplicate list key, which a recycling list
// must never see (it misroutes taps to the wrong detail), so we collapse repeats here.
//
// `genreSlugs` optionally filters the feed to vinyls carrying ANY of the given genres (OR). Each
// filter combination caches under its own key, so switching filters is instant once warmed and the
// unfiltered feed is never evicted.
export function useVinyls(
  genreSlugs: readonly string[] = [],
): UseInfiniteQueryResult<VinylSummaryDto[], Error> {
  // Comma-separated slugs is the wire shape (GET /vinyls?genres=disco,funk); omit when empty so the
  // request is the plain unfiltered feed.
  const genres = genreSlugs.length > 0 ? [...genreSlugs].sort().join(',') : undefined;
  return useInfiniteQuery({
    queryKey: queryKeys.vinyls.list(genreSlugs),
    queryFn: async ({ pageParam }): Promise<VinylListDto> => {
      const { data, error } = await apiClient.GET('/vinyls', {
        params: { query: { limit: PAGE_SIZE, cursor: pageParam, genres } },
      });
      if (error || !data) {
        throw new Error('Failed to load vinyls');
      }
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    select: flattenUniqueVinyls,
  });
}

// The validated genres, for the home filter sheet. Rarely changes, so it is cached generously by the
// default query config; the list is short (no pagination).
export function useGenres(): UseQueryResult<GenreDto[]> {
  return useQuery({
    queryKey: queryKeys.genres,
    queryFn: async (): Promise<GenreDto[]> => {
      const { data, error } = await apiClient.GET('/genres');
      if (error || !data) {
        throw new Error('Failed to load genres');
      }
      return data.genres;
    },
  });
}

// Full-text search, cursor-paginated. Disabled until `query` is non-empty (an empty search would
// just page the whole catalog). Same flattening + infinite-scroll machinery as the home feed, so a
// result row behaves identically. The query is trimmed by the caller before it reaches here. Deduped
// by id for the same reason as the home feed: offset paging over results that can shift between page
// fetches must not surface a vinyl twice, or the recycling list keys collide and taps misroute.
export function useVinylSearch(query: string): UseInfiniteQueryResult<VinylSummaryDto[], Error> {
  return useInfiniteQuery({
    queryKey: queryKeys.vinyls.search(query),
    enabled: query.length > 0,
    queryFn: async ({ pageParam }): Promise<VinylListDto> => {
      const { data, error } = await apiClient.GET('/vinyls/search', {
        params: { query: { q: query, limit: PAGE_SIZE, cursor: pageParam } },
      });
      if (error || !data) {
        throw new Error('Search failed');
      }
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    select: flattenUniqueVinyls,
  });
}

// Scan the loaded pages of an infinite vinyls cache for a summary (used to seed the detail sheet).
function findCachedSummary(
  data: InfiniteData<VinylListDto> | undefined,
  id: string,
): VinylSummaryDto | undefined {
  return data?.pages.flatMap((page) => page.vinyls).find((vinyl) => vinyl.id === id);
}

// Scan several infinite vinyls caches (as returned by getQueriesData) for a summary. Used for the
// search results, which live under a per-query key, so there is no single cache to read by key.
function findCachedSummaryAcross(
  entries: [QueryKey, InfiniteData<VinylListDto> | undefined][],
  id: string,
): VinylSummaryDto | undefined {
  for (const [, data] of entries) {
    const found = findCachedSummary(data, id);
    if (found) return found;
  }
  return undefined;
}

export function useVinyl(id: string): UseQueryResult<VinylDto> {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.vinyls.detail(id),
    enabled: id.length > 0,
    // Seed from a cached list so the detail sheet renders instantly. A summary has everything the
    // detail needs except offers; the query then fills those in. Vinyl = VinylSummary + offers.
    placeholderData: (): VinylDto | undefined => {
      // The home feed caches per genre filter (queryKeys.vinyls.list(slugs)), so scan every loaded
      // home-feed cache rather than a single key, the way search is scanned below.
      const fromFeed = findCachedSummaryAcross(
        queryClient.getQueriesData<InfiniteData<VinylListDto>>({
          queryKey: queryKeys.vinyls.listAll,
        }),
        id,
      );
      const fromFavorites = findCachedSummary(
        queryClient.getQueryData<InfiniteData<VinylListDto>>(queryKeys.favorites.vinyls),
        id,
      );
      // Search results live under a per-query key (queryKeys.vinyls.search(q)), so scan every loaded
      // search cache. Without this, opening a vinyl from search has nothing to seed from and shows a
      // spinner, while the home feed and favorites render instantly from their cached summary.
      const fromSearch = findCachedSummaryAcross(
        queryClient.getQueriesData<InfiniteData<VinylListDto>>({
          queryKey: queryKeys.vinyls.searchAll,
        }),
        id,
      );
      const summary = fromFeed ?? fromFavorites ?? fromSearch;
      return summary ? { ...summary, offers: [] } : undefined;
    },
    queryFn: async (): Promise<VinylDto> => {
      const { data, error } = await apiClient.GET('/vinyls/{id}', {
        params: { path: { id } },
      });
      if (error || !data) {
        throw new Error(`Vinyl ${id} not found`);
      }
      return data;
    },
  });
}

// The shop page identity (name, address, vinyl count). The vinyls themselves come from useShopVinyls.
export function useShop(id: string): UseQueryResult<ShopDetailDto> {
  return useQuery({
    queryKey: queryKeys.shops.detail(id),
    enabled: id.length > 0,
    queryFn: async (): Promise<ShopDetailDto> => {
      const { data, error } = await apiClient.GET('/shops/{id}', {
        params: { path: { id } },
      });
      if (error || !data) {
        throw new Error(`Shop ${id} not found`);
      }
      return data;
    },
  });
}

// A shop's vinyls, cursor-paginated. Deduped because one shop can list the same vinyl more than once.
export function useShopVinyls(id: string): UseInfiniteQueryResult<VinylSummaryDto[], Error> {
  return useInfiniteQuery({
    queryKey: queryKeys.shops.vinyls(id),
    enabled: id.length > 0,
    queryFn: async ({ pageParam }): Promise<VinylListDto> => {
      const { data, error } = await apiClient.GET('/shops/{id}/vinyls', {
        params: { path: { id }, query: { limit: PAGE_SIZE, cursor: pageParam } },
      });
      if (error || !data) {
        throw new Error('Failed to load shop vinyls');
      }
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    select: flattenUniqueVinyls,
  });
}

// --- Favorites (per-user, authenticated) ---

const EMPTY_IDS: FavoriteIdsDto = { vinylIds: [], trackIds: [] };

// Rapid taps on a heart should feel instant yet not spam the server. We flip the cache on every tap
// (instant optimistic UI) and debounce the actual POST/DELETE per target, so a burst of taps
// collapses into at most one request reflecting the final state (and zero requests if it nets out
// unchanged, e.g. an even number of taps).
const FAVORITE_SYNC_DEBOUNCE_MS = 400;

// The ids of every favorited target. Cheap (ids only) and complete, so the heart state is correct
// everywhere even though the favorited records themselves are paginated.
export function useFavoriteIds(): UseQueryResult<FavoriteIdsDto> {
  return useQuery({
    queryKey: queryKeys.favorites.ids,
    queryFn: async (): Promise<FavoriteIdsDto> => {
      const { data, error } = await apiClient.GET('/favorites');
      if (error || !data) {
        throw new Error('Failed to load favorites');
      }
      return data;
    },
  });
}

// The favorited vinyls (Records section of the Favorites tab), cursor-paginated.
export function useFavoriteVinyls(): UseInfiniteQueryResult<VinylSummaryDto[], Error> {
  return useInfiniteQuery({
    queryKey: queryKeys.favorites.vinyls,
    queryFn: async ({ pageParam }): Promise<VinylListDto> => {
      const { data, error } = await apiClient.GET('/favorites/vinyls', {
        params: { query: { limit: PAGE_SIZE, cursor: pageParam } },
      });
      if (error || !data) {
        throw new Error('Failed to load favorite vinyls');
      }
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    select: flattenVinyls,
  });
}

// The favorited tracks (Tracks section of the Favorites tab). Not paginated: tracks are not a
// vinyls list, so they load in one shot.
export function useFavoriteTracks(): UseQueryResult<FavoriteTrackDto[]> {
  return useQuery({
    queryKey: queryKeys.favorites.tracks,
    queryFn: async (): Promise<FavoriteTrackDto[]> => {
      const { data, error } = await apiClient.GET('/favorites/tracks');
      if (error || !data) {
        throw new Error('Failed to load favorite tracks');
      }
      return data.tracks;
    },
  });
}

function isFavoriteInIds(
  ids: FavoriteIdsDto,
  targetType: 'vinyl' | 'track',
  targetId: string,
): boolean {
  return targetType === 'vinyl'
    ? ids.vinylIds.includes(targetId)
    : ids.trackIds.includes(targetId);
}

// Derive a single item's favorite state from the ids cache (subscribes to the same query, so the
// heart updates the instant the optimistic toggle rewrites the cache).
export function useIsFavorite(targetType: 'vinyl' | 'track', targetId: string): boolean {
  const { data } = useFavoriteIds();
  return data ? isFavoriteInIds(data, targetType, targetId) : false;
}

// What a button hands to toggle(): the target plus the full DTO so the optimistic insert can render
// immediately. The desired add/remove direction is computed by the hook from the cache, not passed
// in, so fast clicks always resolve against the latest state rather than a stale render.
export type ToggleFavoriteTarget =
  | { targetType: 'vinyl'; vinyl: VinylSummaryDto }
  | { targetType: 'track'; track: FavoriteTrackDto };

// Internal: a resolved intent (target + direction) for the cache writer and the network call.
type FavoriteMutation = ToggleFavoriteTarget & { add: boolean };

function targetIdOf(target: ToggleFavoriteTarget): string {
  return target.targetType === 'vinyl' ? target.vinyl.id : target.track.id;
}

// What goes under the "Added to favorites" toast: the record/track that was favorited.
function favoriteToastDescription(target: ToggleFavoriteTarget): string {
  return target.targetType === 'vinyl'
    ? `${target.vinyl.title} - ${target.vinyl.artist}`
    : `${target.track.title} - ${target.track.vinyl.artist}`;
}

// Flip a target in the ids cache (drives every heart instantly).
function applyIdsToggle(ids: FavoriteIdsDto, m: FavoriteMutation): FavoriteIdsDto {
  const id = targetIdOf(m);
  if (m.targetType === 'vinyl') {
    const without = ids.vinylIds.filter((x) => x !== id);
    return { ...ids, vinylIds: m.add ? [id, ...without] : without };
  }
  const without = ids.trackIds.filter((x) => x !== id);
  return { ...ids, trackIds: m.add ? [id, ...without] : without };
}

export interface ToggleFavoriteApi {
  toggle: (target: ToggleFavoriteTarget) => void;
  isPending: boolean;
}

// Optimistic + debounced favorite toggle. Each tap flips the ids cache instantly (the heart) and the
// rendered Favorites lists (so a favorite added/removed from any screen shows up there immediately);
// the persisted POST/DELETE is debounced per target and only fired when the final state differs from
// where the burst started. On error or settle it reconciles against the server (never mid-burst,
// which would clobber an optimistic flip a pending tap depends on).
export function useToggleFavorite(): ToggleFavoriteApi {
  const queryClient = useQueryClient();
  // Per-target debounce bookkeeping, keyed by `${targetType}:${targetId}`.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const burstStartState = useRef(new Map<string, boolean>());
  const latest = useRef(new Map<string, FavoriteMutation>());

  // Optimistically reflect the toggle in the rendered Favorites lists (the paginated vinyls and the
  // tracks list), so an item added/removed anywhere appears/disappears in the Favorites tab at once.
  const applyListToggle = useCallback(
    (m: FavoriteMutation) => {
      if (m.targetType === 'vinyl') {
        const vinyl = m.vinyl;
        queryClient.setQueryData<InfiniteData<VinylListDto>>(
          queryKeys.favorites.vinyls,
          (old) => {
            if (!old) return old;
            // Drop the vinyl from every page first (so add never duplicates it).
            const pages = old.pages.map((page) => ({
              ...page,
              vinyls: page.vinyls.filter((v) => v.id !== vinyl.id),
            }));
            if (!m.add) return { ...old, pages };
            const first = pages[0];
            if (!first) return { ...old, pages };
            return {
              ...old,
              pages: [{ ...first, vinyls: [vinyl, ...first.vinyls] }, ...pages.slice(1)],
            };
          },
        );
        return;
      }
      const track = m.track;
      queryClient.setQueryData<FavoriteTrackDto[]>(queryKeys.favorites.tracks, (old) => {
        const without = (old ?? []).filter((t) => t.id !== track.id);
        return m.add ? [track, ...without] : without;
      });
    },
    [queryClient],
  );

  const sync = useMutation({
    mutationFn: async (m: FavoriteMutation): Promise<void> => {
      const targetId = targetIdOf(m);
      if (m.add) {
        const { error } = await apiClient.POST('/favorites', {
          body: { targetType: m.targetType, targetId },
        });
        if (error) throw new Error('Failed to add favorite');
        return;
      }
      const { error } = await apiClient.DELETE('/favorites/{targetType}/{targetId}', {
        params: { path: { targetType: m.targetType, targetId } },
      });
      if (error) throw new Error('Failed to remove favorite');
    },
    onSettled: () => {
      // Reconcile with the server once the dust settles, but never while taps are still in flight
      // (an invalidation mid-burst would refetch over the optimistic state).
      if (timers.current.size === 0) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.favorites.ids });
        void queryClient.invalidateQueries({ queryKey: queryKeys.favorites.vinyls });
        void queryClient.invalidateQueries({ queryKey: queryKeys.favorites.tracks });
      }
    },
  });

  const flush = useCallback(
    (key: string) => {
      timers.current.delete(key);
      const start = burstStartState.current.get(key) ?? false;
      burstStartState.current.delete(key);
      const m = latest.current.get(key);
      latest.current.delete(key);
      if (!m) return;
      // Even number of taps: desired state equals the server state, so nothing needs to be sent.
      if (m.add === start) return;
      // Toast only on a net add (the persisted intent), so a burst that nets out shows nothing and a
      // net remove stays silent. Fired here (the debounced commit) rather than per tap, so it tracks
      // the truth we send rather than every optimistic flip.
      if (m.add) {
        toast.success('Added to favorites', { description: favoriteToastDescription(m) });
      }
      sync.mutate(m);
    },
    [sync],
  );

  // Always flush the latest pending intent; keep it in a ref so unmount cleanup can fire it without
  // re-subscribing the effect on every render.
  const flushRef = useRef(flush);
  flushRef.current = flush;

  const toggle = useCallback(
    (target: ToggleFavoriteTarget) => {
      const targetId = targetIdOf(target);
      const key = `${target.targetType}:${targetId}`;

      const current = queryClient.getQueryData<FavoriteIdsDto>(queryKeys.favorites.ids);
      const wasFavorite = current ? isFavoriteInIds(current, target.targetType, targetId) : false;
      const m: FavoriteMutation = { ...target, add: !wasFavorite };

      // 1) Instant optimistic UI: flip the ids cache (the heart) and the rendered Favorites lists.
      queryClient.setQueryData<FavoriteIdsDto>(
        queryKeys.favorites.ids,
        applyIdsToggle(current ?? EMPTY_IDS, m),
      );
      applyListToggle(m);

      // 2) Capture the server-truth state at the start of a burst (first tap only).
      if (!timers.current.has(key)) {
        burstStartState.current.set(key, wasFavorite);
      }
      latest.current.set(key, m);

      // 3) (Re)arm the debounce; only the final tap's resolved intent is persisted.
      const existing = timers.current.get(key);
      if (existing) clearTimeout(existing);
      timers.current.set(
        key,
        setTimeout(() => flushRef.current(key), FAVORITE_SYNC_DEBOUNCE_MS),
      );
    },
    [queryClient, applyListToggle],
  );

  // On unmount, flush pending intents immediately so a quick tap-then-navigate is still persisted.
  useEffect(() => {
    const timerMap = timers.current;
    return () => {
      for (const [key, timer] of timerMap) {
        clearTimeout(timer);
        flushRef.current(key);
      }
    };
  }, []);

  return { toggle, isPending: sync.isPending };
}

// --- Social: profile, follow, collections (per-user, authenticated) ---

// The signed-in user's own profile. Drives the onboarding gate (username === null means the user
// still needs to claim one) and the profile tab. `enabled` is left default; it is only mounted once
// signed in (the gate), and the client forwards the session cookie.
export function useMyProfile(enabled = true): UseQueryResult<MyProfileDto> {
  return useQuery({
    queryKey: queryKeys.profile,
    enabled,
    queryFn: async (): Promise<MyProfileDto> => {
      const { data, error } = await apiClient.GET('/me/profile');
      if (error || !data) {
        throw new Error('Failed to load profile');
      }
      return data;
    },
  });
}

// Edit the signed-in user's profile (display name, bio, avatar). Refreshes the profile cache on success.
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateProfileDto): Promise<MyProfileDto> => {
      const { data, error } = await apiClient.PUT('/me/profile', { body });
      if (error || !data) {
        throw new Error('Failed to update profile');
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.profile, data);
    },
  });
}

// Claim or change the username (onboarding + later edits). Throws a tagged error on a 409 so the
// caller can surface "that username is taken" distinctly from a generic failure.
export function useClaimUsername() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (username: string): Promise<MyProfileDto> => {
      const { data, error, response } = await apiClient.POST('/me/username', { body: { username } });
      if (response.status === 409) {
        throw new Error('taken');
      }
      if (error || !data) {
        throw new Error('Failed to set username');
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.profile, data);
    },
  });
}

// Live availability check for the onboarding field. Disabled until the handle looks plausible
// (length >= 3); debounce the input in the component before passing it here.
export function useUsernameAvailable(username: string): UseQueryResult<UsernameAvailabilityDto> {
  return useQuery({
    queryKey: queryKeys.usernameAvailable(username),
    enabled: username.length >= 3,
    queryFn: async (): Promise<UsernameAvailabilityDto> => {
      const { data, error } = await apiClient.GET('/usernames/available', {
        params: { query: { username } },
      });
      if (error || !data) {
        throw new Error('Failed to check username');
      }
      return data;
    },
  });
}

// A public user profile by username (viewer-aware follow state + counts).
export function useUser(username: string): UseQueryResult<PublicUserDto> {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.users.detail(username),
    enabled: username.length > 0,
    // Seed the signed-in user's own profile from the cached MyProfile (already warmed by the root
    // gate) so the "You" tab paints the identity instantly instead of flashing a spinner while the
    // public profile loads. MyProfile carries the identity but none of the social counts, so those
    // start at 0 and fill in the moment the fetch settles (same seed-then-fill pattern as useVinyl).
    placeholderData: (): PublicUserDto | undefined => {
      const me = queryClient.getQueryData<MyProfileDto>(queryKeys.profile);
      if (!me || me.username !== username) return undefined;
      return {
        username: me.username,
        displayName: me.displayName,
        avatarUrl: me.avatarUrl,
        bio: me.bio,
        isMe: true,
        isFollowing: false,
        followerCount: 0,
        followingCount: 0,
        collectionCount: 0,
        favoriteCount: 0,
      };
    },
    queryFn: async (): Promise<PublicUserDto> => {
      const { data, error } = await apiClient.GET('/users/{username}', {
        params: { path: { username } },
      });
      if (error || !data) {
        throw new Error(`User ${username} not found`);
      }
      return data;
    },
  });
}

// Follow / unfollow a user. Optimistic: flips the cached profile's `isFollowing` and nudges the
// follower count immediately, reconciling on settle. Read state via the useUser cache.
export function useFollowUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      username,
      follow,
    }: {
      username: string;
      follow: boolean;
    }): Promise<void> => {
      if (follow) {
        const { error } = await apiClient.POST('/users/{username}/follow', {
          params: { path: { username } },
        });
        if (error) throw new Error('Failed to follow');
        return;
      }
      const { error } = await apiClient.DELETE('/users/{username}/follow', {
        params: { path: { username } },
      });
      if (error) throw new Error('Failed to unfollow');
    },
    onMutate: async ({ username, follow }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.users.detail(username) });
      const previous = queryClient.getQueryData<PublicUserDto>(queryKeys.users.detail(username));
      if (previous) {
        queryClient.setQueryData<PublicUserDto>(queryKeys.users.detail(username), {
          ...previous,
          isFollowing: follow,
          followerCount: Math.max(0, previous.followerCount + (follow ? 1 : -1)),
        });
      }
      return { previous };
    },
    onError: (_err, { username }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.users.detail(username), context.previous);
      }
    },
    onSettled: (_data, _err, { username }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(username) });
      // The signed-in user's own following count lives on their profile screen; refresh it.
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });
}

function flattenUsers(data: InfiniteData<UserListDto>): UserSummaryDto[] {
  return data.pages.flatMap((page) => page.users);
}

// A user's followers, cursor-paginated.
export function useFollowers(username: string): UseInfiniteQueryResult<UserSummaryDto[], Error> {
  return useInfiniteQuery({
    queryKey: queryKeys.users.followers(username),
    enabled: username.length > 0,
    queryFn: async ({ pageParam }): Promise<UserListDto> => {
      const { data, error } = await apiClient.GET('/users/{username}/followers', {
        params: { path: { username }, query: { limit: PAGE_SIZE, cursor: pageParam } },
      });
      if (error || !data) {
        throw new Error('Failed to load followers');
      }
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    select: flattenUsers,
  });
}

// The users a user follows, cursor-paginated.
export function useFollowing(username: string): UseInfiniteQueryResult<UserSummaryDto[], Error> {
  return useInfiniteQuery({
    queryKey: queryKeys.users.following(username),
    enabled: username.length > 0,
    queryFn: async ({ pageParam }): Promise<UserListDto> => {
      const { data, error } = await apiClient.GET('/users/{username}/following', {
        params: { path: { username }, query: { limit: PAGE_SIZE, cursor: pageParam } },
      });
      if (error || !data) {
        throw new Error('Failed to load following');
      }
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    select: flattenUsers,
  });
}

// A user's favorited vinyls (public), cursor-paginated.
export function useUserFavorites(username: string): UseInfiniteQueryResult<VinylSummaryDto[], Error> {
  return useInfiniteQuery({
    queryKey: queryKeys.users.favorites(username),
    enabled: username.length > 0,
    queryFn: async ({ pageParam }): Promise<VinylListDto> => {
      const { data, error } = await apiClient.GET('/users/{username}/favorites', {
        params: { path: { username }, query: { limit: PAGE_SIZE, cursor: pageParam } },
      });
      if (error || !data) {
        throw new Error('Failed to load favorites');
      }
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    select: flattenVinyls,
  });
}

// A user's collections (not paginated: a short list).
export function useUserCollections(username: string): UseQueryResult<CollectionDto[]> {
  return useQuery({
    queryKey: queryKeys.users.collections(username),
    enabled: username.length > 0,
    queryFn: async (): Promise<CollectionDto[]> => {
      const { data, error } = await apiClient.GET('/users/{username}/collections', {
        params: { path: { username } },
      });
      if (error || !data) {
        throw new Error('Failed to load collections');
      }
      return data.collections;
    },
  });
}

// The signed-in user's own collections.
export function useMyCollections(): UseQueryResult<CollectionDto[]> {
  return useQuery({
    queryKey: queryKeys.collections.mine,
    queryFn: async (): Promise<CollectionDto[]> => {
      const { data, error } = await apiClient.GET('/me/collections');
      if (error || !data) {
        throw new Error('Failed to load collections');
      }
      return data.collections;
    },
  });
}

// A single collection's metadata + owner.
export function useCollection(id: string): UseQueryResult<CollectionDto> {
  return useQuery({
    queryKey: queryKeys.collections.detail(id),
    enabled: id.length > 0,
    queryFn: async (): Promise<CollectionDto> => {
      const { data, error } = await apiClient.GET('/collections/{id}', {
        params: { path: { id } },
      });
      if (error || !data) {
        throw new Error(`Collection ${id} not found`);
      }
      return data;
    },
  });
}

// A collection's vinyls, cursor-paginated.
export function useCollectionVinyls(id: string): UseInfiniteQueryResult<VinylSummaryDto[], Error> {
  return useInfiniteQuery({
    queryKey: queryKeys.collections.vinyls(id),
    enabled: id.length > 0,
    queryFn: async ({ pageParam }): Promise<VinylListDto> => {
      const { data, error } = await apiClient.GET('/collections/{id}/vinyls', {
        params: { path: { id }, query: { limit: PAGE_SIZE, cursor: pageParam } },
      });
      if (error || !data) {
        throw new Error('Failed to load collection');
      }
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    select: flattenUniqueVinyls,
  });
}

// The collections rail on every profile (own + others) reads useUserCollections, keyed per username
// (['users', <username>, 'collections']), and the profile header reads useUser, keyed per username
// (['users', <username>]) for its collectionCount. Creating, renaming, or deleting a collection
// changes both, but the username sits in the middle of those keys so no prefix matches them:
// invalidate via a predicate. (Mirrors the reconcile in useToggleCollectionVinyl.)
function invalidateProfileCollections(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === 'users' &&
      (query.queryKey.length === 2 || query.queryKey[2] === 'collections'),
  });
}

// Create a collection. Refreshes the owner's collection lists on success.
export function useCreateCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateCollectionDto): Promise<CollectionDto> => {
      const { data, error } = await apiClient.POST('/me/collections', { body });
      if (error || !data) {
        throw new Error('Failed to create collection');
      }
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections.mine });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
      invalidateProfileCollections(queryClient);
    },
  });
}

// Edit a collection (name / description).
export function useUpdateCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: UpdateCollectionDto;
    }): Promise<CollectionDto> => {
      const { data, error } = await apiClient.PUT('/collections/{id}', {
        params: { path: { id } },
        body,
      });
      if (error || !data) {
        throw new Error('Failed to update collection');
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.collections.detail(data.id), data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections.mine });
      invalidateProfileCollections(queryClient);
    },
  });
}

// Delete a collection.
export function useDeleteCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await apiClient.DELETE('/collections/{id}', { params: { path: { id } } });
      if (error) throw new Error('Failed to delete collection');
    },
    onSuccess: (_data, id) => {
      // Drop the dead collection's own caches so nothing refetches a 404 (the detail screen has
      // already popped back), then refresh the lists that surfaced it.
      queryClient.removeQueries({ queryKey: queryKeys.collections.detail(id) });
      queryClient.removeQueries({ queryKey: queryKeys.collections.vinyls(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections.mine });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
      invalidateProfileCollections(queryClient);
    },
  });
}

// Which of my collections contain a vinyl (drives the add-to-collection sheet's checkmarks).
export function useCollectionMemberships(vinylId: string): UseQueryResult<CollectionMembershipsDto> {
  return useQuery({
    queryKey: queryKeys.collections.memberships(vinylId),
    enabled: vinylId.length > 0,
    queryFn: async (): Promise<CollectionMembershipsDto> => {
      const { data, error } = await apiClient.GET('/me/collection-memberships', {
        params: { query: { vinylId } },
      });
      if (error || !data) {
        throw new Error('Failed to load collections');
      }
      return data;
    },
  });
}

// Add / remove a vinyl to/from a collection. Optimistic on the memberships cache so the sheet's
// checkmark flips instantly; reconciles the affected collection lists on settle.
export function useToggleCollectionVinyl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      collectionId,
      vinylId,
      add,
    }: {
      collectionId: string;
      vinylId: string;
      add: boolean;
    }): Promise<void> => {
      if (add) {
        const { error } = await apiClient.POST('/collections/{id}/vinyls', {
          params: { path: { id: collectionId } },
          body: { vinylId },
        });
        if (error) throw new Error('Failed to add to collection');
        return;
      }
      const { error } = await apiClient.DELETE('/collections/{id}/vinyls/{vinylId}', {
        params: { path: { id: collectionId, vinylId } },
      });
      if (error) throw new Error('Failed to remove from collection');
    },
    onMutate: async ({ collectionId, vinylId, add }) => {
      const key = queryKeys.collections.memberships(vinylId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CollectionMembershipsDto>(key);
      const current = previous?.collectionIds ?? [];
      const next = add
        ? [...new Set([...current, collectionId])]
        : current.filter((id) => id !== collectionId);
      queryClient.setQueryData<CollectionMembershipsDto>(key, { collectionIds: next });
      return { previous };
    },
    onError: (_err, { vinylId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.collections.memberships(vinylId), context.previous);
      }
    },
    onSettled: (_data, _err, { collectionId, vinylId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections.memberships(vinylId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections.mine });
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections.detail(collectionId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections.vinyls(collectionId) });
      // Adding/removing a record changes a collection's record count and cover mosaic, so refresh
      // the per-username profile caches that render the rail (and its collectionCount).
      invalidateProfileCollections(queryClient);
    },
  });
}
