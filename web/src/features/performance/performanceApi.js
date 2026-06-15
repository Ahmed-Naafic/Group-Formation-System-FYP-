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
    recalculateClass: build.mutation({
      query: (classId) => ({
        url: `/api/performance/recalculate/class/${classId}`,
        method: 'POST',
      }),
      transformResponse: (res) => res.data,
      invalidatesTags: ['Student'],
    }),
    updateAttendance: build.mutation({
      query: (body) => ({ url: '/api/performance/attendance', method: 'POST', body }),
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
  useRecalculateClassMutation,
  useUpdateAttendanceMutation,
  useUpdateScoresMutation,
} = performanceApi;
