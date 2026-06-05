import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type {
  FavoritesDto,
  FavoriteTrackDto,
  VinylDto,
  VinylSummaryDto,
} from '@getvinyls/api-client';
import { apiClient } from './client';
import { queryKeys } from './queryKeys';

// react-query hooks wrapping the typed client. These live in the app, not in
// @getvinyls/api-client (which stays React-free). No hand-written fetch, zero any.

export function useVinyls(): UseQueryResult<VinylSummaryDto[]> {
  return useQuery({
    queryKey: queryKeys.vinyls.all,
    queryFn: async (): Promise<VinylSummaryDto[]> => {
      const { data, error } = await apiClient.GET('/vinyls');
      if (error || !data) {
        throw new Error('Failed to load vinyls');
      }
      return data.vinyls;
    },
  });
}

export function useVinyl(id: string): UseQueryResult<VinylDto> {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.vinyls.detail(id),
    enabled: id.length > 0,
    // Seed from the cached list so the detail sheet renders instantly. A summary has everything
    // the detail needs except offers; the query then fills those in. Vinyl = VinylSummary + offers.
    placeholderData: (): VinylDto | undefined => {
      const list = queryClient.getQueryData<VinylSummaryDto[]>(queryKeys.vinyls.all);
      const summary = list?.find((vinyl) => vinyl.id === id);
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

// --- Favorites (per-user, authenticated) ---

const EMPTY_FAVORITES: FavoritesDto = { vinyls: [], tracks: [], total: 0 };

// Rapid taps on a heart should feel instant yet not spam the server. We flip the cache on every tap
// (instant optimistic UI) and debounce the actual POST/DELETE per target, so a burst of taps
// collapses into at most one request reflecting the final state (and zero requests if it nets out
// unchanged, e.g. an even number of taps).
const FAVORITE_SYNC_DEBOUNCE_MS = 400;

export function useFavorites(): UseQueryResult<FavoritesDto> {
  return useQuery({
    queryKey: queryKeys.favorites.all,
    queryFn: async (): Promise<FavoritesDto> => {
      const { data, error } = await apiClient.GET('/favorites');
      if (error || !data) {
        throw new Error('Failed to load favorites');
      }
      return data;
    },
  });
}

function isFavoriteIn(
  data: FavoritesDto,
  targetType: 'vinyl' | 'track',
  targetId: string,
): boolean {
  return targetType === 'vinyl'
    ? data.vinyls.some((vinyl) => vinyl.id === targetId)
    : data.tracks.some((track) => track.id === targetId);
}

// Derive a single item's favorite state from the favorites cache (subscribes to the same query, so
// the heart updates the instant the optimistic toggle rewrites the cache).
export function useIsFavorite(targetType: 'vinyl' | 'track', targetId: string): boolean {
  const { data } = useFavorites();
  return data ? isFavoriteIn(data, targetType, targetId) : false;
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

function applyToggle(current: FavoritesDto, m: FavoriteMutation): FavoritesDto {
  if (m.targetType === 'vinyl') {
    const without = current.vinyls.filter((vinyl) => vinyl.id !== m.vinyl.id);
    const vinyls = m.add ? [m.vinyl, ...without] : without;
    return { ...current, vinyls, total: vinyls.length + current.tracks.length };
  }
  const without = current.tracks.filter((track) => track.id !== m.track.id);
  const tracks = m.add ? [m.track, ...without] : without;
  return { ...current, tracks, total: current.vinyls.length + tracks.length };
}

export interface ToggleFavoriteApi {
  toggle: (target: ToggleFavoriteTarget) => void;
  isPending: boolean;
}

// Optimistic + debounced favorite toggle. Each tap flips the cache instantly; the persisted
// POST/DELETE is debounced per target and only fired when the final state differs from where the
// burst started. On error or settle it reconciles against the server (never mid-burst, which would
// clobber an optimistic flip a pending tap depends on).
export function useToggleFavorite(): ToggleFavoriteApi {
  const queryClient = useQueryClient();
  // Per-target debounce bookkeeping, keyed by `${targetType}:${targetId}`.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const burstStartState = useRef(new Map<string, boolean>());
  const latest = useRef(new Map<string, FavoriteMutation>());

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
        void queryClient.invalidateQueries({ queryKey: queryKeys.favorites.all });
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

      const current = queryClient.getQueryData<FavoritesDto>(queryKeys.favorites.all);
      const wasFavorite = current ? isFavoriteIn(current, target.targetType, targetId) : false;
      const m: FavoriteMutation = { ...target, add: !wasFavorite };

      // 1) Instant optimistic UI: flip the cache now so the heart responds on every tap.
      queryClient.setQueryData<FavoritesDto>(
        queryKeys.favorites.all,
        applyToggle(current ?? EMPTY_FAVORITES, m),
      );

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
    [queryClient],
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
