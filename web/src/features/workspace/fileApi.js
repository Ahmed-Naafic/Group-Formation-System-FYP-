import { baseApi } from '@/lib/api';

export const fileApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getFiles: build.query({
      query: (workspaceId) => `/api/workspaces/${workspaceId}/files`,
      transformResponse: (res) => res.data.files,
      providesTags: (result, error, workspaceId) => [{ type: 'File', id: workspaceId }],
    }),

    uploadFile: build.mutation({
      query: ({ workspaceId, formData }) => ({
        url: `/api/workspaces/${workspaceId}/files`,
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: (result, error, { workspaceId }) => [{ type: 'File', id: workspaceId }],
    }),

    deleteFile: build.mutation({
      query: ({ workspaceId, fileId }) => ({
        url: `/api/workspaces/${workspaceId}/files/${fileId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { workspaceId }) => [{ type: 'File', id: workspaceId }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetFilesQuery,
  useUploadFileMutation,
  useDeleteFileMutation,
} = fileApi;
