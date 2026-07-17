import { baseApi } from '@/lib/api';

export const aiApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    generateTask: build.mutation({
      query: (prompt) => ({ url: '/api/ai/generate-task', method: 'POST', body: { prompt } }),
      transformResponse: (res) => res.data,
    }),
  }),
  overrideExisting: false,
});

export const { useGenerateTaskMutation } = aiApi;
