import { baseApi } from '@/lib/api';

export const studentApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getStudents: build.query({
      query: (classId) => ({ url: '/api/students', params: { classId } }),
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

    bulkUploadStudents: build.mutation({
      query: ({ classId, file }) => {
        const formData = new FormData();
        formData.append('classId', classId);
        formData.append('file', file);
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
} = studentApi;
