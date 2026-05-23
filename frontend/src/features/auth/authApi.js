import { createApi } from '@reduxjs/toolkit/query/react';
import { createAuthBaseQuery } from '../../services/authBaseQuery';
import { resetUserData } from '../../utils/resetUserData';
import { logout, logoutCustomer, setCredentials, setUserProfile } from './authSlice';

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: createAuthBaseQuery(),
  tagTypes: ['AuthUser'],
  endpoints: (builder) => ({
    register: builder.mutation({
      query: (userData) => ({
        url: '/auth/register',
        method: 'POST',
        body: userData,
      }),
    }),
    sendOtp: builder.mutation({
      query: (data) => ({
        url: '/auth/send-otp',
        method: 'POST',
        body: data,
      }),
    }),
    verifyOtp: builder.mutation({
      query: (data) => ({
        url: '/auth/verify-otp',
        method: 'POST',
        body: data,
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        const user = data?.user;
        if (user) {
          dispatch(
            setCredentials({
              role: user.role || 'user',
              userId: user.id,
              user,
              isCustomer: true,
            })
          );
        }
      },
    }),
    getCurrentUser: builder.query({
      query: () => '/auth/me',
      providesTags: ['AuthUser'],
    }),
    logout: builder.mutation({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        await queryFulfilled.catch(() => {});
        dispatch(logoutCustomer());
        resetUserData(dispatch);
      },
    }),
  }),
});

export const {
  useRegisterMutation,
  useSendOtpMutation,
  useVerifyOtpMutation,
  useGetCurrentUserQuery,
  useLogoutMutation,
} = authApi;
