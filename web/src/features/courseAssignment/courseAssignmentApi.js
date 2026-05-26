import { baseApi } from '@/lib/api';

export const courseAssignmentApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCourseAssignments: build.query({
      query: () => '/api/course-assignments',
      transformResponse: (res) => res.data.assignments,
      providesTags: ['CourseAssignment'],
    }),
    createCourseAssignment: build.mutation({
      query: (body) => ({ url: '/api/course-assignments', method: 'POST', body }),
      transformResponse: (res) => res.data.assignment,
    }),
    deleteCourseAssignment: build.mutation({
      query: (id) => ({ url: `/api/course-assignments/${id}`, method: 'DELETE' }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCourseAssignmentsQuery,
  useCreateCourseAssignmentMutation,
  useDeleteCourseAssignmentMutation,
} = courseAssignmentApi;
