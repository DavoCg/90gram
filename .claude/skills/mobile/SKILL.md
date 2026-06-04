---
name: mobile
description: >-
  Conventions for apps/mobile: Expo (SDK 56, dev build via prebuild, NOT Expo Go), Expo Router
  with typed routes, Uniwind (Tailwind v4 for RN) styling, TanStack Query v5 hooks wrapping the
  generated api-client, and FlashList. Read this when adding screens/routes, styling with
  className, writing data hooks/query keys, or touching Metro/Uniwind/theme config.
---

# Mobile (apps/mobile)

Expo SDK 56, New Architecture (always on). This is a **dev build** (`expo prebuild` + native run),
NOT Expo Go, because `react-native-audio-api` needs native modules. Expo Router for file-based, typed routes.

## Styling: Uniwind (Tailwind v4 for RN)

- Build-time compile via the Metro config wrapper (`withUniwindConfig` in `metro.config.js`). There is NO
  `tailwind.config.js`. Tokens and themes live in `global.css` using Tailwind v4 `@theme` and the
  light/dark theme blocks. No Babel preset (Uniwind dropped it).
- Style with `className` strings on RN components. Keep tokens in `global.css`; do not hardcode colors.

## Data: TanStack Query v5 + generated client

- Import `createApiClient` from `@getvinyls/api-client` and instantiate ONE client (base URL from
  `EXPO_PUBLIC_API_BASE_URL`). The react-query hooks live HERE, not in the client package.
- Hooks: `useRecords()` (list), `useRecord(id)` (detail). Query keys are stable and centralized
  (`queryKeys.records.all`, `queryKeys.records.detail(id)`). Wrap the app in `QueryClientProvider`.
- No hand-written fetch. Every call goes through the typed client; responses are fully typed, zero `any`.

## State management

- **Server/data state: TanStack Query** (the hooks above). **Client/UI state: Legend State** observables
  (`@legendapp/state`). The two collaborate: query owns fetched data and cache; Legend State owns local UI
  state like the player. The player store is `player$` in `src/audio/store.ts` (see the audio skill).
- Read observables in components with `use$(player$.x)` from `@legendapp/state/react` (fine-grained: only the
  fields you read trigger re-render). Write from non-React code (the engine) with `.set()` / `.assign()`.

## Performance

- Use `FlashList` (not `FlatList`) for the record list. Memoize row components (`React.memo`), pass stable
  keys, and avoid inline closures that defeat memoization in hot lists.
- Keep re-renders tight: read narrow `use$` slices; never `setState` per animation frame (see the audio
  skill for the visualizer rules).

## Structure

`app/` holds routes (Expo Router). `src/` holds non-route code: `api/` (client + hooks + query keys),
`audio/` (player module, store, visualizer; see the audio skill), `components/`, `theme/`.
