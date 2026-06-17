import { observable } from '@legendapp/state';

// Applied home-feed filters. Client/UI state (the repo convention: server data in react-query,
// local UI state in Legend State, see player$ in src/audio/store). It lives here, not in HomeScreen,
// because the filter sheet is now a route (app/(tabs)/(home)/filter.tsx) that cannot receive an
// onApply callback as a prop. The home screen reads the applied genres to build its query key; the
// filter route writes them on "Show results". Reset to an empty selection.
export interface Filters {
  // Applied genre slugs, OR semantics. Empty means no genre filter.
  genres: string[];
}

export const filters$ = observable<Filters>({ genres: [] });
