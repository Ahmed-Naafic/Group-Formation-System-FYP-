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
    getWorkspaceByGroupId: build.query({
      query: (groupId) => `/api/workspaces/by-group/${groupId}`,
      transformResponse: (res) => res.data.workspace,
      providesTags: (result) => result ? [{ type: 'Workspace', id: result._id }] : [],
    }),
    getMessages: build.query({
      query: (workspaceId) => `/api/workspaces/${workspaceId}/messages`,
      transformResponse: (res) => res.data.messages,
      providesTags: (result, error, workspaceId) => [{ type: 'Message', id: workspaceId }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetMyWorkspacesQuery,
  useGetWorkspaceByIdQuery,
  useGetWorkspaceByGroupIdQuery,
  useLazyGetWorkspaceByGroupIdQuery,
  useGetMessagesQuery,
} = workspaceApi;
