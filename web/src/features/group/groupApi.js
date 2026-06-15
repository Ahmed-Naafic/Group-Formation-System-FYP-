import { baseApi } from '@/lib/api';

export const groupApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getGroups: build.query({
      query: ({ classId, courseId }) => ({ url: '/api/groups', params: { classId, courseId } }),
      transformResponse: (res) => res.data.groups,
      providesTags: (result) =>
        result
          ? [...result.map(({ _id }) => ({ type: 'Group', id: _id })), 'Group']
          : ['Group'],
    }),

    getGroupById: build.query({
      query: (id) => `/api/groups/${id}`,
      transformResponse: (res) => res.data.group,
      providesTags: (result, error, id) => [{ type: 'Group', id }],
    }),

    generateGroups: build.mutation({
      query: (body) => ({ url: '/api/groups/generate', method: 'POST', body }),
      transformResponse: (res) => res.data,
      invalidatesTags: ['Group'],
    }),

    regenerateGroups: build.mutation({
      query: (body) => ({ url: '/api/groups/regenerate', method: 'POST', body }),
      transformResponse: (res) => res.data,
      invalidatesTags: ['Group'],
    }),

    updateGroup: build.mutation({
      query: ({ id, ...body }) => ({ url: `/api/groups/${id}`, method: 'PATCH', body }),
      transformResponse: (res) => res.data.group,
      invalidatesTags: (result, error, { id }) => [{ type: 'Group', id }, 'Group'],
    }),

    deleteGroups: build.mutation({
      query: ({ classId, courseId }) => ({
        url: `/api/groups?classId=${classId}&courseId=${courseId}`,
        method: 'DELETE',
      }),
      transformResponse: (res) => res.data,
      invalidatesTags: ['Group'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetGroupsQuery,
  useGetGroupByIdQuery,
  useGenerateGroupsMutation,
  useRegenerateGroupsMutation,
  useUpdateGroupMutation,
  useDeleteGroupsMutation,
} = groupApi;
