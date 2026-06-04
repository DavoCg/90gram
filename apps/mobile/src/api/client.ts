import { createApiClient } from '@getvinyls/api-client';
import { env } from '../env';

// One typed client for the whole app, built from the generated openapi-fetch factory.
export const apiClient = createApiClient({ baseUrl: env.EXPO_PUBLIC_API_BASE_URL });
