import { baseApi } from '@/lib/api';

export const userApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getUsers: build.query({
      query: (params = {}) => ({ url: '/api/users', params }),
      transformResponse: (res) => res.data.users,
      providesTags: ['User'],
    }),
    createInstructor: build.mutation({
      query: (body) => ({ url: '/api/users', method: 'POST', body }),
      transformResponse: (res) => res.data.user,
      invalidatesTags: ['User'],
    }),
    updateInstructor: build.mutation({
      query: ({ id, ...body }) => ({ url: `/api/users/${id}`, method: 'PATCH', body }),
      transformResponse: (res) => res.data.user,
      invalidatesTags: ['User'],
    }),
    activateInstructor: build.mutation({
      query: (id) => ({ url: `/api/users/${id}/activate`, method: 'PATCH' }),
      transformResponse: (res) => res.data.user,
      invalidatesTags: ['User'],
    }),
    deactivateInstructor: build.mutation({
      query: (id) => ({ url: `/api/users/${id}/deactivate`, method: 'PATCH' }),
      transformResponse: (res) => res.data.user,
      invalidatesTags: ['User'],
    }),
    deleteInstructor: build.mutation({
      query: (id) => ({ url: `/api/users/${id}`, method: 'DELETE' }),
      invalidatesTags: ['User'],
    }),
    // Same endpoint as deleteInstructor — the backend dispatches by the
    // target account's role. Separate hook name only for readability at the
    // Students-tab call site.
    deactivateStudentAccount: build.mutation({
      query: (id) => ({ url: `/api/users/${id}`, method: 'DELETE' }),
      invalidatesTags: ['User', 'Student'],
    }),
    restoreUser: build.mutation({
      query: (id) => ({ url: `/api/users/${id}/restore`, method: 'PATCH' }),
      transformResponse: (res) => res.data.user,
      invalidatesTags: ['User', 'Student'],
    }),
    resetUserPassword: build.mutation({
      query: (id) => ({ url: `/api/users/${id}/reset-password`, method: 'POST' }),
      transformResponse: (res) => res.data,
      invalidatesTags: ['User'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetUsersQuery,
  useCreateInstructorMutation,
  useUpdateInstructorMutation,
  useActivateInstructorMutation,
  useDeactivateInstructorMutation,
  useDeleteInstructorMutation,
  useResetUserPasswordMutation,
  useDeactivateStudentAccountMutation,
  useRestoreUserMutation,
} = userApi;
