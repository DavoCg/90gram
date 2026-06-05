---
name: mobile
description: >-
  Conventions for apps/mobile: Expo (SDK 56, dev build via prebuild, NOT Expo Go), Expo Router
  with typed routes, Uniwind (Tailwind v4 for RN) styling, TanStack Query v5 hooks wrapping the
  generated api-client, and FlashList. Read this when adding screens/routes, styling with
  className, writing data hooks/query keys, or touching Metro/Uniwind/theme config.
---

# Mobile (apps/mobile)

Expo SDK 56, New Architecture (always on). This is a **dev build**, NOT Expo Go, because
`react-native-audio-api` needs native modules. Expo Router for file-based, typed routes.

## Builds: EAS

The app builds via **EAS Build** (`apps/mobile/eas.json`), so no local Xcode/Android is required. Profiles:
`development` (dev client, internal distribution, iOS simulator + Android APK), `preview` (internal testers),
`production` (stores). The `development` profile needs `expo-dev-client` (installed). Run `eas init` once to
create the project (writes `extra.eas.projectId` into `app.json`), then `eas build --profile development`.
A local build still works too (`expo prebuild` + `expo run:ios|android`) if you have the native toolchain.

CI/CD is **EAS Workflows** in `apps/mobile/.eas/workflows/`: `ci.yml` (PR lint + typecheck as a custom job,
no build credits), `development-build.yml` and `deploy-production.yml` (manual `workflow_dispatch` builds;
production has commented store-submit jobs). Keep CI scoped to `pnpm --filter @getvinyls/mobile` so it stays
fast and does not pull in the Python scraper (no `uv` on the workers) or need a database.

This is a **pnpm monorepo**, so `metro.config.js` sets `watchFolders` to the workspace root and
`resolver.nodeModulesPaths` to both the app and the hoisted root `node_modules` (`.npmrc` uses
`node-linker=hoisted`). Keep that in place or Metro/EAS will fail to resolve workspace packages.

## Styling: Uniwind (Tailwind v4 for RN)

- Build-time compile via the Metro config wrapper (`withUniwindConfig` in `metro.config.js`). There is NO
  `tailwind.config.js`. Tokens and themes live in `global.css` using Tailwind v4 `@theme` and the
  light/dark theme blocks. No Babel preset (Uniwind dropped it).
- Style with `className` strings on RN components. Keep tokens in `global.css`; do not hardcode colors.

## Data: TanStack Query v5 + generated client

- Import `createApiClient` from `@getvinyls/api-client` and instantiate ONE client (base URL from
  `EXPO_PUBLIC_API_BASE_URL`). The react-query hooks live HERE, not in the client package.
- Hooks: `useVinyls()` (list), `useVinyl(id)` (detail). Query keys are stable and centralized
  (`queryKeys.vinyls.all`, `queryKeys.vinyls.detail(id)`). Wrap the app in `QueryClientProvider`.
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
- Keep re-renders tight: read narrow `use$` slices; never `setState` per animation frame (the SeekBar /
  VolumeSlider drive everything that moves during a drag with Reanimated shared values on the UI thread).

## Structure

`app/` holds routes (Expo Router). `src/` holds non-route code: `api/` (client + hooks + query keys),
`audio/` (engine + playback service + store; see the audio skill), `components/`, `theme/`.
