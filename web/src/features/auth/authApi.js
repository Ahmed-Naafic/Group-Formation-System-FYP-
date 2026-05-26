import { baseApi } from '@/lib/api';

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (credentials) => ({
        url: '/api/auth/login',
        method: 'POST',
        body: credentials,
      }),
      // Backend shape: { success, data: { token, user, mustChangePassword }, message }
      transformResponse: (res) => res.data,
    }),

    changePassword: builder.mutation({
      query: (body) => ({
        url: '/api/auth/change-password',
        method: 'POST',
        body,
      }),
      // Backend shape: { success, data: { token, user }, message }
      transformResponse: (res) => res.data,
    }),
  }),
  overrideExisting: false,
});

export const { useLoginMutation, useChangePasswordMutation } = authApi;
