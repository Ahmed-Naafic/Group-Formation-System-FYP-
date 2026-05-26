import { baseApi } from '@/lib/api';

export const departmentApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getDepartments: build.query({
      query: () => '/api/departments',
      transformResponse: (res) => res.data.departments,
      providesTags: ['Department'],
    }),
    createDepartment: build.mutation({
      query: (body) => ({ url: '/api/departments', method: 'POST', body }),
      transformResponse: (res) => res.data.department,
      invalidatesTags: ['Department'],
    }),
    updateDepartment: build.mutation({
      query: ({ id, ...body }) => ({ url: `/api/departments/${id}`, method: 'PATCH', body }),
      transformResponse: (res) => res.data.department,
      invalidatesTags: ['Department'],
    }),
    deleteDepartment: build.mutation({
      query: (id) => ({ url: `/api/departments/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Department'],
    }),
  }),
});

export const {
  useGetDepartmentsQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
} = departmentApi;
