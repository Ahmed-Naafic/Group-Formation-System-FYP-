import { baseApi } from '@/lib/api';

export const auditLogApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAuditLogs: build.query({
      query: ({ action, entityKind, page = 1, limit = 50 } = {}) => ({
        url: '/api/audit-logs',
        params: {
          ...(action     && { action }),
          ...(entityKind && { entityKind }),
          page,
          limit,
        },
      }),
      transformResponse: (res) => res.data, // { logs, total, page, pages }
    }),
  }),
  overrideExisting: false,
});

export const { useGetAuditLogsQuery } = auditLogApi;
