import { createSlice } from '@reduxjs/toolkit';
import {
  clearUserSessionStorage,
  getStoredUserId,
  setStoredUserSession,
} from '../../utils/userSession';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    userId: getStoredUserId(),
    user: null,
    isLoggedIn: !!localStorage.getItem('isLoggedIn'),
    role: localStorage.getItem('role') || null,
    isAuthenticated:
      !!localStorage.getItem('isLoggedIn') ||
      localStorage.getItem('customerLoggedIn') === 'true',
    isCustomerLoggedIn: localStorage.getItem('customerLoggedIn') === 'true',
  },
  reducers: {
    setCredentials: (state, action) => {
      const { role, userId, user, isAdmin, isCustomer } = action.payload;
      const resolvedUserId = userId || user?.id || user?._id;

      if (isAdmin) {
        state.role = role;
        state.isLoggedIn = true;
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('role', role);
      }

      if (isCustomer || (!isAdmin && resolvedUserId)) {
        state.isCustomerLoggedIn = true;
        state.user = user || state.user;
        if (resolvedUserId) {
          state.userId = String(resolvedUserId);
          setStoredUserSession({
            userId: state.userId,
          });
        }
      }

      state.isAuthenticated = state.isLoggedIn || state.isCustomerLoggedIn;
    },
    setUserProfile: (state, action) => {
      state.user = action.payload;
    },
    logout: (state) => {
      state.userId = null;
      state.user = null;
      state.role = null;
      state.isLoggedIn = false;
      state.isAuthenticated = false;
      state.isCustomerLoggedIn = false;
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('role');
      clearUserSessionStorage();
    },
    logoutCustomer: (state) => {
      state.userId = null;
      state.user = null;
      state.isCustomerLoggedIn = false;
      state.isAuthenticated = state.isLoggedIn;
      clearUserSessionStorage();
    },
  },
});

export const { setCredentials, setUserProfile, logout, logoutCustomer } = authSlice.actions;
export default authSlice.reducer;
