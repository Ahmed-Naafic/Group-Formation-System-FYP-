import { baseApi } from '@/lib/api';

export const attendanceApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAttendance: build.query({
      query: (courseOfferingId) => ({ url: '/api/attendance', params: { courseOfferingId } }),
      transformResponse: (res) => res.data.records,
      providesTags: (result, error, id) => [{ type: 'Attendance', id }],
    }),

    bulkUpsertAttendance: build.mutation({
      query: ({ courseOfferingId, records }) => ({
        url: '/api/attendance/bulk',
        method: 'POST',
        body: { courseOfferingId, records },
      }),
      invalidatesTags: (result, error, { courseOfferingId }) => [{ type: 'Attendance', id: courseOfferingId }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAttendanceQuery,
  useBulkUpsertAttendanceMutation,
} = attendanceApi;
