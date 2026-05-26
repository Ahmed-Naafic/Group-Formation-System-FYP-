import { baseApi } from '@/lib/api';

export const classApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getClasses: build.query({
      query: (params = {}) => ({
        url: '/api/classes',
        params,
      }),
      transformResponse: (res) => res.data.classes,
      providesTags: ['Class'],
    }),
    getClassById: build.query({
      query: (id) => `/api/classes/${id}`,
      transformResponse: (res) => res.data.class,
      providesTags: (result, error, id) => [{ type: 'Class', id }],
    }),
    createClass: build.mutation({
      query: (body) => ({ url: '/api/classes', method: 'POST', body }),
      transformResponse: (res) => res.data.class,
      invalidatesTags: ['Class'],
    }),
    updateClass: build.mutation({
      query: ({ id, ...body }) => ({ url: `/api/classes/${id}`, method: 'PATCH', body }),
      transformResponse: (res) => res.data.class,
      invalidatesTags: ['Class'],
    }),
    deleteClass: build.mutation({
      query: (id) => ({ url: `/api/classes/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Class'],
    }),
  }),
});

export const {
  useGetClassesQuery,
  useGetClassByIdQuery,
  useCreateClassMutation,
  useUpdateClassMutation,
  useDeleteClassMutation,
} = classApi;
