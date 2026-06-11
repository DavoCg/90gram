import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { defineConfig } from 'vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nitro } from 'nitro/vite';

// TanStack Start (Vite) admin app. `resolve.tsconfigPaths` wires the `@/*` alias from tsconfig.
// nitro() emits a Node server build to `.output/server/index.mjs` (the `start` script runs it),
// which is what the Fly image launches.
export default defineConfig({
  server: {
    port: Number(process.env.ADMIN_PORT ?? process.env.PORT ?? 3000),
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      srcDirectory: 'src',
    }),
    viteReact(),
    nitro(),
  ],
});
