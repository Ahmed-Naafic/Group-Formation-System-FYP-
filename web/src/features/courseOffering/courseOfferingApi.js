import { baseApi } from '@/lib/api';

export const courseOfferingApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCourseOfferings: build.query({
      query: (params = {}) => ({ url: '/api/course-offerings', params }),
      transformResponse: (res) => res.data.offerings,
      providesTags: ['CourseOffering'],
    }),
    createCourseOffering: build.mutation({
      query: (body) => ({ url: '/api/course-offerings', method: 'POST', body }),
      transformResponse: (res) => res.data.offering,
      invalidatesTags: ['CourseOffering'],
    }),
    updateCourseOffering: build.mutation({
      query: ({ id, ...body }) => ({ url: `/api/course-offerings/${id}`, method: 'PATCH', body }),
      transformResponse: (res) => res.data.offering,
      invalidatesTags: ['CourseOffering'],
    }),
    getCourseOfferingById: build.query({
      query: (id) => `/api/course-offerings/${id}`,
      transformResponse: (res) => res.data.offering,
      providesTags: (result, error, id) => [{ type: 'CourseOffering', id }],
    }),

    deleteCourseOffering: build.mutation({
      query: (id) => ({ url: `/api/course-offerings/${id}`, method: 'DELETE' }),
      invalidatesTags: ['CourseOffering'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCourseOfferingsQuery,
  useGetCourseOfferingByIdQuery,
  useCreateCourseOfferingMutation,
  useUpdateCourseOfferingMutation,
  useDeleteCourseOfferingMutation,
} = courseOfferingApi;
