---
name: mobile
description: >-
  Conventions for apps/mobile: Expo (SDK 56, dev build via prebuild, NOT Expo Go), Expo Router
  with typed routes, Uniwind (Tailwind v4 for RN) styling, TanStack Query v5 hooks wrapping the
  generated api-client, and LegendList. Read this when adding screens/routes, styling with
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

## Authentication (better-auth)

The app is fully gated behind sign-in. `src/auth/client.ts` holds the ONE better-auth client (the
`expoClient` plugin stores the session token in `expo-secure-store`, plus `emailOTPClient` for the
passwordless code flow); it points at the API's `/api/auth/*` handler via `EXPO_PUBLIC_API_BASE_URL`.
The root `app/_layout.tsx` reads `authClient.useSession()` and redirects: signed-out users go to the
`(auth)` group (`app/(auth)/sign-in.tsx`, a two-step email then 6-digit code screen), and the tab
navigator plus the global mini-player only mount once signed in. Read the session with
`authClient.useSession()`, sign out with `authClient.signOut()` (the gate handles navigation). Auth does
NOT go through the generated api-client; that client only forwards the better-auth cookie so future
per-user endpoints are authenticated.

## Social (profiles, follow, collections)

The **Profile ("You") tab** (`app/(tabs)/profile/`) replaced the old Radio tab. It is its own stack
(like Home/Favorites) so user profiles, collections, and records opened from them push on top while
the tab bar and mini-player stay put. The shared profile view is `src/screens/profile.tsx` (used by
both the "You" tab and `user/[username]`; it shows owner affordances when `isMe`, else a follow
button). Other screens: `edit`, `followers`/`following` (shared `src/screens/user-list.tsx`),
`collection/[id]`, plus `vinyl/[id]` + `shop/[id]` re-exports so the shared detail screens work inside
this stack too. Create-collection is NOT nested here: it is a ROOT form sheet (`app/new-collection.tsx`,
like the currency / add-to-collection sheets). Keep form sheets as root routes (or non-anchor screens),
not as declared `<Stack.Screen>` children of a tab stack, or that child becomes the stack's initial
route and the tab opens onto it instead of its index.

**Onboarding**: `app/(onboarding)/profile-setup.tsx` claims a unique username after the first
sign-in. The root gate (`app/_layout.tsx`) reads `useMyProfile()` and, while signed in with a null
username, mounts `(onboarding)` instead of `(tabs)`; claiming a username flips the guard. The gate
latches `appReady` once auth AND the first profile load settle, so the cold-start splash covers the
onboarding-vs-tabs decision.

**Add to collection** is a root form sheet (`app/add-to-collection.tsx`, like the currency picker),
opened from a record's page; it toggles membership (optimistic, mirrors the favorites pattern) and can
create a collection inline. Social hooks live in `src/api/hooks.ts` (keys under `queryKeys.profile`,
`queryKeys.users.*`, `queryKeys.collections.*`); components: `Avatar`, `FollowButton`, `UserRow`,
`CollectionCard`. Profiles, favorites, and collections are public; only writes need a session.

## Forms

- **Every form uses TanStack Form** (`@tanstack/react-form`). Use `useForm({ defaultValues, onSubmit })`
  directly (no `createFormHook` factory); never hand-roll `useState` per field. Render fields with
  `<form.Field name validators={{ onChange }}>` and gate the submit button with
  `<form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>`. Field-level validation lives on the
  form; surface server errors (e.g. better-auth) in separate local state. `apps/(auth)/sign-in.tsx` is the
  reference (an email form and a code form, one per step).
- Text fields use the `Input` component (`src/components/input`); one-time codes use the `OTPInput`
  component (`src/components/otp-input`, built on `input-otp-native`): six per-digit slots, a blinking
  caret, and a shake-on-error (`useShake` + `expo-haptics`) driven by its `state` prop
  (`idle`/`error`/`loading`/`success`). Wire it to a field with `value`/`onChange` and submit on
  `onComplete`.

## State management

- **Server/data state: TanStack Query** (the hooks above). **Client/UI state: Legend State** observables
  (`@legendapp/state`). The two collaborate: query owns fetched data and cache; Legend State owns local UI
  state like the player. The player store is `player$` in `src/audio/store.ts` (see the audio skill).
- Read observables in components with `use$(player$.x)` from `@legendapp/state/react` (fine-grained: only the
  fields you read trigger re-render). Write from non-React code (the engine) with `.set()` / `.assign()`.

## Internationalization

The app is fully translated with **i18next + react-i18next** (en/fr/de/es, English fallback). There is
**no hardcoded user-facing copy**: every visible string goes through `t()` from `useTranslation(ns)`.
Locale bundles live in `src/i18n/locales/<lang>/<namespace>.json` (scoped namespaces); the language is
a per-user setting (`useDisplayLanguage`) that mirrors the currency setting. **Whenever you add a
screen or any user-facing string, add its keys to ALL FOUR languages.** Read the `i18n` skill before
touching copy, adding a screen, or changing the language setting.

## Performance

- Use `LegendList` (from `@legendapp/list/react-native`), not `FlatList`/`FlashList`, for the record lists.
  Memoize row components (`React.memo`), pass stable keys, and avoid inline closures that defeat memoization
  in hot lists. Turn on `recycleItems` (rows are stateless and memoized, so view reuse is safe); pass
  `estimatedItemSize` (a first-render hint only, it is optional and the measured sizes take over after layout).
- Keep re-renders tight: read narrow `use$` slices; never `setState` per animation frame (the SeekBar /
  VolumeSlider drive everything that moves during a drag with Reanimated shared values on the UI thread).

## Structure

`app/` holds routes (Expo Router). `src/` holds non-route code: `api/` (client + hooks + query keys),
`audio/` (engine + playback service + store; see the audio skill), `components/`, `theme/`.
