import { baseApi } from '@/lib/api';

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getDashboardStats: build.query({
      query: () => '/api/dashboard',
      transformResponse: (res) => res.data,
    }),

    getInstructorDashboardStats: build.query({
      query: () => '/api/dashboard/instructor',
      transformResponse: (res) => res.data,
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetDashboardStatsQuery,
  useGetInstructorDashboardStatsQuery,
} = dashboardApi;
