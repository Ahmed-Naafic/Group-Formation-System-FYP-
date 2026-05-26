import { createSlice } from '@reduxjs/toolkit';

// Hydrate from sessionStorage so a page refresh doesn't log the user out.
// Side-effect writes happen in the reducers below (pragmatic, not pure).
function load(key) {
  try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; }
}

const initialState = {
  token:              load('token'),
  user:               load('user'),
  mustChangePassword: load('mustChangePassword') ?? false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, { payload }) {
      state.token              = payload.token;
      state.user               = payload.user ?? null;
      state.mustChangePassword = payload.mustChangePassword ?? false;

      sessionStorage.setItem('token', JSON.stringify(payload.token));
      sessionStorage.setItem('user',  JSON.stringify(payload.user ?? null));
      sessionStorage.setItem('mustChangePassword', JSON.stringify(payload.mustChangePassword ?? false));
    },
    clearCredentials(state) {
      state.token              = null;
      state.user               = null;
      state.mustChangePassword = false;

      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('mustChangePassword');
    },
  },
});

export const { setCredentials, clearCredentials } = authSlice.actions;

export const selectCurrentToken      = (state) => state.auth.token;
export const selectCurrentUser       = (state) => state.auth.user;
export const selectIsAuth            = (state) => Boolean(state.auth.token);
export const selectMustChangePassword = (state) => state.auth.mustChangePassword;
export const selectRole              = (state) => state.auth.user?.role ?? null;

export default authSlice.reducer;
