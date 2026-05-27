import { baseApi } from '@/lib/api';

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getDashboardStats: build.query({
      query: () => '/api/dashboard',
      transformResponse: (res) => res.data,
      // counts: { users, students, classes, activeGroups, submissions }
      // submissions: { draft, submitted, late, reviewed }
      // recentActivity: [...auditLog entries]
    }),
  }),
  overrideExisting: false,
});

export const { useGetDashboardStatsQuery } = dashboardApi;
