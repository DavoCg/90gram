import { useCallback, useEffect, useRef } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  FavoriteIdsDto,
  FavoriteTrackDto,
  ShopDetailDto,
  VinylDto,
  VinylListDto,
  VinylSummaryDto,
} from '@getvinyls/api-client';
import { apiClient } from './client';
import { queryKeys } from './queryKeys';

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
// fetchNextPage() when the list nears its end (hasNextPage gates whether there is more).
export function useVinyls(): UseInfiniteQueryResult<VinylSummaryDto[], Error> {
  return useInfiniteQuery({
    queryKey: queryKeys.vinyls.list,
    queryFn: async ({ pageParam }): Promise<VinylListDto> => {
      const { data, error } = await apiClient.GET('/vinyls', {
        params: { query: { limit: PAGE_SIZE, cursor: pageParam } },
      });
      if (error || !data) {
        throw new Error('Failed to load vinyls');
      }
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    select: flattenVinyls,
  });
}

// Full-text search, cursor-paginated. Disabled until `query` is non-empty (an empty search would
// just page the whole catalog). Same flattening + infinite-scroll machinery as the home feed, so a
// result row behaves identically. The query is trimmed by the caller before it reaches here.
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
    select: flattenVinyls,
  });
}

// Scan the loaded pages of an infinite vinyls cache for a summary (used to seed the detail sheet).
function findCachedSummary(
  data: InfiniteData<VinylListDto> | undefined,
  id: string,
): VinylSummaryDto | undefined {
  return data?.pages.flatMap((page) => page.vinyls).find((vinyl) => vinyl.id === id);
}

export function useVinyl(id: string): UseQueryResult<VinylDto> {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.vinyls.detail(id),
    enabled: id.length > 0,
    // Seed from a cached list so the detail sheet renders instantly. A summary has everything the
    // detail needs except offers; the query then fills those in. Vinyl = VinylSummary + offers.
    placeholderData: (): VinylDto | undefined => {
      const fromFeed = findCachedSummary(
        queryClient.getQueryData<InfiniteData<VinylListDto>>(queryKeys.vinyls.list),
        id,
      );
      const fromFavorites = findCachedSummary(
        queryClient.getQueryData<InfiniteData<VinylListDto>>(queryKeys.favorites.vinyls),
        id,
      );
      const summary = fromFeed ?? fromFavorites;
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
