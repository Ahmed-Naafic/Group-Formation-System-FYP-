import { baseApi } from '@/lib/api';

export const aiApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    generateTask: build.mutation({
      query: (prompt) => ({ url: '/api/ai/generate-task', method: 'POST', body: { prompt } }),
      transformResponse: (res) => res.data,
    }),

    generateTaskVariations: build.mutation({
      query: ({ prompt, groupIds }) => ({
        url: '/api/ai/generate-task-variations',
        method: 'POST',
        body: { prompt, groupIds },
      }),
      transformResponse: (res) => res.data.variations,
    }),
  }),
  overrideExisting: false,
});

export const { useGenerateTaskMutation, useGenerateTaskVariationsMutation } = aiApi;
