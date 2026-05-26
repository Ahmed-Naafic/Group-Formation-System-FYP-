import { baseApi } from '@/lib/api';

export const workspaceApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMyWorkspaces: build.query({
      query: () => '/api/workspaces',
      transformResponse: (res) => res.data.workspaces,
      providesTags: ['Workspace'],
    }),
    getWorkspaceById: build.query({
      query: (id) => `/api/workspaces/${id}`,
      transformResponse: (res) => res.data.workspace,
      providesTags: (result, error, id) => [{ type: 'Workspace', id }],
    }),
  }),
  overrideExisting: false,
});

export const { useGetMyWorkspacesQuery, useGetWorkspaceByIdQuery } = workspaceApi;
