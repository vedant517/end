import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from './apiConfig';

/** Shared RTK Query base — uses cookies via credentials: include for user APIs. */
export const createAuthBaseQuery = () =>
  fetchBaseQuery({
    baseUrl: API_BASE_URL,
    credentials: 'include',
  });
