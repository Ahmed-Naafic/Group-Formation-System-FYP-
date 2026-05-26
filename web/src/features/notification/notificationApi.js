import { baseApi } from '@/lib/api';

export const notificationApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getNotifications: build.query({
      query: () => '/api/notifications',
      transformResponse: (res) => res.data, // { notifications, unreadCount }
      providesTags: ['Notification'],
    }),

    markRead: build.mutation({
      query: (id) => ({ url: `/api/notifications/${id}/read`, method: 'PATCH' }),
      invalidatesTags: ['Notification'],
    }),

    markAllRead: build.mutation({
      query: () => ({ url: '/api/notifications/read-all', method: 'PATCH' }),
      invalidatesTags: ['Notification'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetNotificationsQuery,
  useMarkReadMutation,
  useMarkAllReadMutation,
} = notificationApi;
