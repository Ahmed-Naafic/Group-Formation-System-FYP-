import { baseApi } from '@/lib/api';

export const groupHistoryApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getGroupHistory: build.query({
      query: (courseOfferingId) => ({ url: '/api/groups/history', params: { courseOfferingId } }),
      transformResponse: (res) => res.data.generations,
    }),
  }),
  overrideExisting: false,
});

export const { useGetGroupHistoryQuery } = groupHistoryApi;
