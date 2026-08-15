import { baseApi } from '@/lib/api';

export const reportApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAnalyticsReport: build.query({
      query: (params) => ({ url: '/api/reports/analytics', params }),
      transformResponse: (res) => res.data.report,
    }),
  }),
  overrideExisting: false,
});

export const { useGetAnalyticsReportQuery, useLazyGetAnalyticsReportQuery } = reportApi;
