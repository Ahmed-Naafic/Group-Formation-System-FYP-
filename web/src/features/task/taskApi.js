import { baseApi } from '@/lib/api';

export const taskApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getTasks: build.query({
      query: (classId) => ({ url: '/api/tasks', params: { classId } }),
      transformResponse: (res) => res.data.tasks,
      providesTags: (result) =>
        result
          ? [...result.map(({ _id }) => ({ type: 'Task', id: _id })), 'Task']
          : ['Task'],
    }),

    getTaskById: build.query({
      query: (id) => `/api/tasks/${id}`,
      transformResponse: (res) => res.data.task,
      providesTags: (result, error, id) => [{ type: 'Task', id }],
    }),

    createTask: build.mutation({
      query: (body) => ({ url: '/api/tasks', method: 'POST', body }),
      transformResponse: (res) => res.data.task,
      invalidatesTags: ['Task'],
    }),

    updateTask: build.mutation({
      query: ({ id, ...body }) => ({ url: `/api/tasks/${id}`, method: 'PATCH', body }),
      transformResponse: (res) => res.data.task,
      invalidatesTags: (result, error, { id }) => [{ type: 'Task', id }, 'Task'],
    }),

    deleteTask: build.mutation({
      query: (id) => ({ url: `/api/tasks/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Task'],
    }),

    getTaskSubmissions: build.query({
      query: (taskId) => `/api/tasks/${taskId}/submissions`,
      transformResponse: (res) => res.data.submissions,
      providesTags: (result, error, taskId) =>
        result
          ? [...result.map(({ _id }) => ({ type: 'Submission', id: _id })), { type: 'Submission', id: taskId }]
          : [{ type: 'Submission', id: taskId }],
    }),

    gradeSubmission: build.mutation({
      query: ({ id, grade }) => ({ url: `/api/submissions/${id}/grade`, method: 'PATCH', body: { grade } }),
      transformResponse: (res) => res.data.submission,
      invalidatesTags: (result, error, { id }) => [{ type: 'Submission', id }, 'Submission'],
    }),

    // Student: get their group's current submission for a task (null = not started)
    getMySubmission: build.query({
      query: (taskId) => `/api/tasks/${taskId}/my-submission`,
      transformResponse: (res) => res.data.submission,
      providesTags: (result, error, taskId) => [{ type: 'Submission', id: `my-${taskId}` }],
    }),

    // Student: save draft
    saveDraft: build.mutation({
      query: ({ taskId, notes }) => ({
        url: `/api/tasks/${taskId}/draft`,
        method: 'POST',
        body: { notes: notes || undefined },
      }),
      transformResponse: (res) => res.data.submission,
      invalidatesTags: (result, error, { taskId }) => [{ type: 'Submission', id: `my-${taskId}` }],
    }),

    // Student: submit
    submitTask: build.mutation({
      query: ({ taskId, notes }) => ({
        url: `/api/tasks/${taskId}/submit`,
        method: 'POST',
        body: { notes: notes || undefined },
      }),
      transformResponse: (res) => res.data.submission,
      invalidatesTags: (result, error, { taskId }) => [{ type: 'Submission', id: `my-${taskId}` }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetTasksQuery,
  useGetTaskByIdQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useGetTaskSubmissionsQuery,
  useGradeSubmissionMutation,
  useGetMySubmissionQuery,
  useSaveDraftMutation,
  useSubmitTaskMutation,
} = taskApi;
