import { baseApi } from '@/lib/api';

export const performanceApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPerformanceSettings: build.query({
      query: () => '/api/performance/settings',
      transformResponse: (res) => res.data.settings,
      providesTags: ['Performance'],
    }),
    updatePerformanceSettings: build.mutation({
      query: (body) => ({ url: '/api/performance/settings', method: 'PUT', body }),
      transformResponse: (res) => ({ ...res.data, message: res.message }),
      invalidatesTags: ['Performance'],
    }),
    recalculateCohort: build.mutation({
      query: (cohortId) => ({
        url: `/api/performance/recalculate/cohort/${cohortId}`,
        method: 'POST',
      }),
      transformResponse: (res) => res.data,
      invalidatesTags: ['Student'],
    }),
    updateScores: build.mutation({
      query: (body) => ({ url: '/api/performance/scores', method: 'POST', body }),
      transformResponse: (res) => res.data,
      invalidatesTags: ['Student'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetPerformanceSettingsQuery,
  useUpdatePerformanceSettingsMutation,
  useRecalculateCohortMutation,
  useUpdateScoresMutation,
} = performanceApi;
