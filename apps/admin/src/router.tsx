import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

// TanStack Start entry: the Vite plugin imports getRouter() to build the SSR + client router.
export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',
    scrollRestoration: true,
  });
}
