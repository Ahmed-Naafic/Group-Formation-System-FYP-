import { baseApi } from '@/lib/api';

export const facultyApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getFaculties: build.query({
      query: () => '/api/faculty',
      transformResponse: (res) => res.data.faculties,
      providesTags: ['Faculty'],
    }),
    createFaculty: build.mutation({
      query: (body) => ({ url: '/api/faculty', method: 'POST', body }),
      transformResponse: (res) => res.data.faculty,
      invalidatesTags: ['Faculty'],
    }),
    updateFaculty: build.mutation({
      query: ({ id, ...body }) => ({ url: `/api/faculty/${id}`, method: 'PATCH', body }),
      transformResponse: (res) => res.data.faculty,
      invalidatesTags: ['Faculty'],
    }),
    deleteFaculty: build.mutation({
      query: (id) => ({ url: `/api/faculty/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Faculty'],
    }),
  }),
});

export const {
  useGetFacultiesQuery,
  useCreateFacultyMutation,
  useUpdateFacultyMutation,
  useDeleteFacultyMutation,
} = facultyApi;
