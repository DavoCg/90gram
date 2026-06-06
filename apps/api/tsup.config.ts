import { defineConfig } from 'tsup';

// Production build for the API. tsup (esbuild) bundles the TypeScript entry into a single
// ESM file at dist/index.js that plain `node` runs (see the `start` script). We bundle rather
// than `tsc` because @getvinyls/db is consumed as raw TS source and the generated Prisma client
// uses bundler-style resolution (extensionless relative imports, `.js` specifiers that point at
// `.ts` files). tsc would emit those specifiers unchanged and Node's ESM loader would reject
// them; esbuild resolves and inlines them.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  bundle: true,
  // @getvinyls/db is a workspace dep, so tsup would externalize it by default. Force it (and the
  // generated Prisma client it pulls in) into the bundle; everything else in dependencies stays
  // external and is resolved from node_modules at runtime.
  noExternal: ['@getvinyls/db'],
  // The Prisma runtime and the pg driver must stay external: the generated client loads
  // `@prisma/client/runtime/client` and the pg adapter at runtime from node_modules.
  external: [/^@prisma\//, /^\.prisma\//, 'pg'],
  clean: true,
  sourcemap: true,
  dts: false,
  splitting: false,
  shims: false,
});
