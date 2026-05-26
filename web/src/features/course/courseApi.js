import { baseApi } from '@/lib/api';

export const courseApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCourses: build.query({
      query: () => '/api/courses',
      transformResponse: (res) => res.data.courses,
      providesTags: ['Course'],
    }),
    createCourse: build.mutation({
      query: (body) => ({ url: '/api/courses', method: 'POST', body }),
      transformResponse: (res) => res.data.course,
      invalidatesTags: ['Course'],
    }),
    updateCourse: build.mutation({
      query: ({ id, ...body }) => ({ url: `/api/courses/${id}`, method: 'PATCH', body }),
      transformResponse: (res) => res.data.course,
      invalidatesTags: ['Course'],
    }),
    deleteCourse: build.mutation({
      query: (id) => ({ url: `/api/courses/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Course'],
    }),
  }),
});

export const {
  useGetCoursesQuery,
  useCreateCourseMutation,
  useUpdateCourseMutation,
  useDeleteCourseMutation,
} = courseApi;
