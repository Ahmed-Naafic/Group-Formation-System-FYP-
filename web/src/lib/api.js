import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { clearCredentials } from '@/features/auth/authSlice';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000').trim(),
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth?.token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

// Retry delays for network errors (Render free-tier cold start can take up to 60s)
const NETWORK_RETRY_DELAYS = [5000, 8000, 10000, 12000, 15000, 15000];

async function baseQueryWithLogout(args, api, extraOptions) {
  let result = await rawBaseQuery(args, api, extraOptions);

  // On connection-level failure, retry with backoff before giving up
  let attempt = 0;
  while (result.error?.status === 'FETCH_ERROR' && attempt < NETWORK_RETRY_DELAYS.length) {
    await new Promise((r) => setTimeout(r, NETWORK_RETRY_DELAYS[attempt]));
    attempt++;
    result = await rawBaseQuery(args, api, extraOptions);
  }

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
