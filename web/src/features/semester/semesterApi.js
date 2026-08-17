import { baseApi } from '@/lib/api';

// Semesters are entirely system-managed (auto-created 1-10 alongside their
// academic year) — there is no create/update/delete here, only reads.
export const semesterApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSemesters: build.query({
      query: (params) => ({ url: '/api/semesters', params }),
      transformResponse: (res) => res.data.semesters,
      providesTags: ['Semester'],
    }),
  }),
});

export const { useGetSemestersQuery } = semesterApi;
