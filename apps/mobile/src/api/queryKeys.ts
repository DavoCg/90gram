// Stable, centralized query keys so cache reads/writes line up across the app.
export const queryKeys = {
  records: {
    all: ['records'] as const,
    detail: (id: string) => ['records', id] as const,
  },
};
