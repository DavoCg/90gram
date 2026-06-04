import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { RecordDto } from '@getvinyls/api-client';
import { apiClient } from './client';
import { queryKeys } from './queryKeys';

// react-query hooks wrapping the typed client. These live in the app, not in
// @getvinyls/api-client (which stays React-free). No hand-written fetch, zero any.

export function useRecords(): UseQueryResult<RecordDto[]> {
  return useQuery({
    queryKey: queryKeys.records.all,
    queryFn: async (): Promise<RecordDto[]> => {
      const { data, error } = await apiClient.GET('/records');
      if (error || !data) {
        throw new Error('Failed to load records');
      }
      return data.records;
    },
  });
}

export function useRecord(id: string): UseQueryResult<RecordDto> {
  return useQuery({
    queryKey: queryKeys.records.detail(id),
    enabled: id.length > 0,
    queryFn: async (): Promise<RecordDto> => {
      const { data, error } = await apiClient.GET('/records/{id}', {
        params: { path: { id } },
      });
      if (error || !data) {
        throw new Error(`Record ${id} not found`);
      }
      return data;
    },
  });
}
