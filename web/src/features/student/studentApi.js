import { baseApi } from '@/lib/api';

export const studentApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getStudents: build.query({
      query: (cohortId) => ({ url: '/api/students', params: { cohortId } }),
      transformResponse: (res) => res.data.students,
      providesTags: (result) =>
        result
          ? [...result.map(({ _id }) => ({ type: 'Student', id: _id })), 'Student']
          : ['Student'],
    }),

    getStudentById: build.query({
      query: (id) => `/api/students/${id}`,
      transformResponse: (res) => res.data.student,
      providesTags: (result, error, id) => [{ type: 'Student', id }],
    }),

    createStudent: build.mutation({
      query: (body) => ({ url: '/api/students', method: 'POST', body }),
      transformResponse: (res) => res.data,
      invalidatesTags: ['Student'],
    }),

    updateStudent: build.mutation({
      query: ({ id, ...body }) => ({ url: `/api/students/${id}`, method: 'PATCH', body }),
      transformResponse: (res) => res.data.student,
      invalidatesTags: (result, error, { id }) => [{ type: 'Student', id }, 'Student'],
    }),

    deleteStudent: build.mutation({
      query: (id) => ({ url: `/api/students/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Student'],
    }),

    resetStudentPassword: build.mutation({
      query: (id) => ({ url: `/api/students/${id}/reset-password`, method: 'POST' }),
      transformResponse: (res) => res.data,
    }),

    clearRoster: build.mutation({
      query: (cohortId) => ({ url: `/api/students?cohortId=${cohortId}`, method: 'DELETE' }),
      transformResponse: (res) => res.data,
      invalidatesTags: ['Student'],
    }),

    getStudentTrash: build.query({
      query: (cohortId) => ({ url: '/api/students/trash', params: { cohortId } }),
      transformResponse: (res) => res.data.students,
      providesTags: ['Student'],
    }),

    restoreStudent: build.mutation({
      query: (id) => ({ url: `/api/students/${id}/restore`, method: 'POST' }),
      transformResponse: (res) => res.data.student,
      invalidatesTags: ['Student'],
    }),

    permanentDeleteStudent: build.mutation({
      query: (id) => ({ url: `/api/students/${id}/permanent`, method: 'DELETE' }),
      invalidatesTags: ['Student'],
    }),

    restoreRoster: build.mutation({
      query: (cohortId) => ({ url: '/api/students/restore-by-cohort', method: 'POST', params: { cohortId } }),
      transformResponse: (res) => res.data,
      invalidatesTags: ['Student'],
    }),

    permanentDeleteRoster: build.mutation({
      query: (cohortId) => ({ url: '/api/students/permanent-by-cohort', method: 'DELETE', params: { cohortId } }),
      transformResponse: (res) => res.data,
      invalidatesTags: ['Student'],
    }),

    bulkUploadStudents: build.mutation({
      query: ({ cohortId, file, confirmTransfers = false }) => {
        const formData = new FormData();
        formData.append('cohortId', cohortId);
        formData.append('file', file);
        if (confirmTransfers) formData.append('confirmTransfers', 'true');
        return { url: '/api/students/bulk-upload', method: 'POST', body: formData };
      },
      transformResponse: (res) => res.data,
      invalidatesTags: ['Student'],
    }),
  }),
});

export const {
  useGetStudentsQuery,
  useGetStudentByIdQuery,
  useCreateStudentMutation,
  useUpdateStudentMutation,
  useDeleteStudentMutation,
  useResetStudentPasswordMutation,
  useBulkUploadStudentsMutation,
  useClearRosterMutation,
  useGetStudentTrashQuery,
  useRestoreStudentMutation,
  usePermanentDeleteStudentMutation,
  useRestoreRosterMutation,
  usePermanentDeleteRosterMutation,
} = studentApi;
