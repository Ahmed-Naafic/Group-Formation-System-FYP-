import { baseApi } from '@/lib/api';

export const semesterApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSemesters: build.query({
      query: () => '/api/semesters',
      transformResponse: (res) => res.data.semesters,
      providesTags: ['Semester'],
    }),
    createSemester: build.mutation({
      query: (body) => ({ url: '/api/semesters', method: 'POST', body }),
      transformResponse: (res) => res.data.semester,
      invalidatesTags: ['Semester'],
    }),
    updateSemester: build.mutation({
      query: ({ id, ...body }) => ({ url: `/api/semesters/${id}`, method: 'PATCH', body }),
      transformResponse: (res) => res.data.semester,
      invalidatesTags: ['Semester'],
    }),
    deleteSemester: build.mutation({
      query: (id) => ({ url: `/api/semesters/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Semester'],
    }),
  }),
});

export const {
  useGetSemestersQuery,
  useCreateSemesterMutation,
  useUpdateSemesterMutation,
  useDeleteSemesterMutation,
} = semesterApi;
