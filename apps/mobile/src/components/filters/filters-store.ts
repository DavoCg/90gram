import { observable } from '@legendapp/state';
import { z } from 'zod';
import { storage } from '../../storage';

// Applied home-feed filters. Client/UI state (the repo convention: server data in react-query,
// local UI state in Legend State, see player$ in src/audio/store). It lives here, not in HomeScreen,
// because the filter sheet is now a route (app/(tabs)/(home)/filter.tsx) that cannot receive an
// onApply callback as a prop. The home screen reads the applied genres to build its query key; the
// filter route writes them on "Show results". Reset to an empty selection.
//
// The selection is PERSISTED in MMKV so it survives a cold start: the home feed reads filters$ to
// build its react-query key, and MMKV reads are synchronous, so seeding the observable at module load
// means the very first useVinyls() render already uses the restored selection (correct cache key, no
// flash, no extra refetch). react-query owns the fetched data; this only persists the filter input.

// Zod is the source of truth for the persisted shape: validating the stored blob means a stale or
// corrupt value can never crash boot, and persisting the whole object means any filter field added
// here later is persisted automatically. `.catch` keeps missing/garbage fields at the empty default.
const filtersSchema = z.object({
  // Applied genre slugs, OR semantics. Empty means no genre filter.
  genres: z.array(z.string()).catch([]),
});

export type Filters = z.infer<typeof filtersSchema>;

const STORAGE_KEY = 'home-filters';

const EMPTY_FILTERS: Filters = { genres: [] };

// Read the persisted selection synchronously at boot. Any failure (no value, bad JSON, schema drift)
// falls back to the empty default rather than throwing.
function loadFilters(): Filters {
  const raw = storage.getString(STORAGE_KEY);
  if (raw === undefined) return EMPTY_FILTERS;
  try {
    return filtersSchema.parse(JSON.parse(raw));
  } catch {
    return EMPTY_FILTERS;
  }
}

export const filters$ = observable<Filters>(loadFilters());

// Persist every change back to MMKV. The filter route's `filters$.genres.set(...)` and the home
// screen's "Clear filters" both flow through here, so the latest applied selection is always saved.
filters$.onChange(({ value }) => {
  storage.set(STORAGE_KEY, JSON.stringify(value));
});
