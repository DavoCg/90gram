import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { VinylDto, VinylSummaryDto } from '@getvinyls/api-client';
import { apiClient } from './client';
import { queryKeys } from './queryKeys';

// react-query hooks wrapping the typed client. These live in the app, not in
// @getvinyls/api-client (which stays React-free). No hand-written fetch, zero any.

export function useVinyls(): UseQueryResult<VinylSummaryDto[]> {
  return useQuery({
    queryKey: queryKeys.vinyls.all,
    queryFn: async (): Promise<VinylSummaryDto[]> => {
      const { data, error } = await apiClient.GET('/vinyls');
      if (error || !data) {
        throw new Error('Failed to load vinyls');
      }
      return data.vinyls;
    },
  });
}

export function useVinyl(id: string): UseQueryResult<VinylDto> {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.vinyls.detail(id),
    enabled: id.length > 0,
    // Seed from the cached list so the detail sheet renders instantly. A summary has everything
    // the detail needs except offers; the query then fills those in. Vinyl = VinylSummary + offers.
    placeholderData: (): VinylDto | undefined => {
      const list = queryClient.getQueryData<VinylSummaryDto[]>(queryKeys.vinyls.all);
      const summary = list?.find((vinyl) => vinyl.id === id);
      return summary ? { ...summary, offers: [] } : undefined;
    },
    queryFn: async (): Promise<VinylDto> => {
      const { data, error } = await apiClient.GET('/vinyls/{id}', {
        params: { path: { id } },
      });
      if (error || !data) {
        throw new Error(`Vinyl ${id} not found`);
      }
      return data;
    },
  });
}
