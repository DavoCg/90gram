// Stable, centralized query keys so cache reads/writes line up across the app.
export const queryKeys = {
  vinyls: {
    all: ['vinyls'] as const,
    detail: (id: string) => ['vinyls', id] as const,
  },
};
