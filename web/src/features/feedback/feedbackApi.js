import { baseApi } from '@/lib/api';

export const feedbackApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getFeedback: build.query({
      query: ({ groupId, taskId }) => ({ url: '/api/feedback', params: { groupId, taskId } }),
      transformResponse: (res) => res.data.feedback,
      providesTags: (result, error, { groupId }) => [{ type: 'Feedback', id: groupId }],
    }),

    submitFeedback: build.mutation({
      query: (body) => ({ url: '/api/feedback', method: 'POST', body }),
      invalidatesTags: (result, error, { groupId }) => [{ type: 'Feedback', id: groupId }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetFeedbackQuery,
  useSubmitFeedbackMutation,
} = feedbackApi;
