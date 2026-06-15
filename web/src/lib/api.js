import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { clearCredentials } from '@/features/auth/authSlice';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000',
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth?.token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

// Wrap the base query: any 401 clears auth state and sends the user to login.
async function baseQueryWithLogout(args, api, extraOptions) {
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status === 401) {
    api.dispatch(clearCredentials());
  }
  return result;
}

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithLogout,
  tagTypes: [
    'Faculty', 'Department', 'Course', 'Semester', 'Class',
    'AcademicYear', 'Cohort', 'CourseOffering',
    'Student', 'Performance', 'Group', 'Workspace', 'User',
    'Task', 'Submission', 'Notification', 'Message', 'File',
    'Attendance',
  ],
  endpoints: () => ({}),
});
