import { baseApi } from '@/lib/api';

export const groupHistoryApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getGroupHistory: build.query({
      query: (cohortId) => ({ url: '/api/groups/history', params: { cohortId } }),
      transformResponse: (res) => res.data.generations,
    }),
  }),
  overrideExisting: false,
});

export const { useGetGroupHistoryQuery } = groupHistoryApi;
