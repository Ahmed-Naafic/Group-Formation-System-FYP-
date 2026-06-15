import { baseApi } from '@/lib/api';

export const cohortApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCohorts: build.query({
      query: (params = {}) => ({ url: '/api/cohorts', params }),
      transformResponse: (res) => res.data.cohorts,
      providesTags: ['Cohort'],
    }),
    createCohort: build.mutation({
      query: (body) => ({ url: '/api/cohorts', method: 'POST', body }),
      transformResponse: (res) => res.data.cohort,
      invalidatesTags: ['Cohort'],
    }),
    updateCohort: build.mutation({
      query: ({ id, ...body }) => ({ url: `/api/cohorts/${id}`, method: 'PATCH', body }),
      transformResponse: (res) => res.data.cohort,
      invalidatesTags: ['Cohort'],
    }),
    deleteCohort: build.mutation({
      query: (id) => ({ url: `/api/cohorts/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Cohort'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCohortsQuery,
  useCreateCohortMutation,
  useUpdateCohortMutation,
  useDeleteCohortMutation,
} = cohortApi;
