import { baseApi } from '@/lib/api';

export const academicYearApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAcademicYears: build.query({
      query: () => '/api/academic-years',
      transformResponse: (res) => res.data.academicYears,
      providesTags: ['AcademicYear'],
    }),
    createAcademicYear: build.mutation({
      query: (body) => ({ url: '/api/academic-years', method: 'POST', body }),
      transformResponse: (res) => res.data.academicYear,
      invalidatesTags: ['AcademicYear'],
    }),
    updateAcademicYear: build.mutation({
      query: ({ id, ...body }) => ({ url: `/api/academic-years/${id}`, method: 'PATCH', body }),
      transformResponse: (res) => res.data.academicYear,
      invalidatesTags: ['AcademicYear'],
    }),
    deleteAcademicYear: build.mutation({
      query: (id) => ({ url: `/api/academic-years/${id}`, method: 'DELETE' }),
      invalidatesTags: ['AcademicYear'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAcademicYearsQuery,
  useCreateAcademicYearMutation,
  useUpdateAcademicYearMutation,
  useDeleteAcademicYearMutation,
} = academicYearApi;
