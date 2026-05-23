import { createApi } from '@reduxjs/toolkit/query/react';
import { createAuthBaseQuery } from '../../services/authBaseQuery';
import { getStoredUserId } from '../../utils/userSession';
import { setWishlistCount } from '../ui/uiSlice';

export const wishlistApi = createApi({
  reducerPath: 'wishlistApi',
  baseQuery: createAuthBaseQuery(),
  tagTypes: ['Wishlist'],
  refetchOnMountOrArgChange: true,
  keepUnusedDataFor: 0,
  endpoints: (builder) => ({

    getWishlist: builder.query({
      query: () => '/wishlist',
      providesTags: ['Wishlist'],
      serializeQueryArgs: ({ endpointName }) =>
        `${endpointName}-${getStoredUserId() || 'guest'}`,
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const list = data?.wishlist ?? [];
          dispatch(setWishlistCount(Array.isArray(list) ? list.length : 0));
        } catch {
          dispatch(setWishlistCount(0));
        }
      },
    }),

    // body should include: { productId, color?, fabric?, variant? }
    addToWishlist: builder.mutation({
      query: (body) => ({
        url: '/wishlist/add',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Wishlist'],
    }),

    // arg: { productId, color?, fabric? }
    removeFromWishlist: builder.mutation({
      query: ({ productId, color, fabric }) => {
        const params = new URLSearchParams();
        if (color)  params.append('color',  color);
        if (fabric) params.append('fabric', fabric);
        const qs = params.toString();
        return {
          url: `/wishlist/remove/${productId}${qs ? `?${qs}` : ''}`,
          method: 'DELETE',
        };
      },
      invalidatesTags: ['Wishlist'],
    }),

    clearWishlist: builder.mutation({
      query: () => ({
        url: '/wishlist/clear',
        method: 'DELETE',
      }),
      invalidatesTags: ['Wishlist'],
    }),
  }),
});

export const {
  useGetWishlistQuery,
  useAddToWishlistMutation,
  useRemoveFromWishlistMutation,
  useClearWishlistMutation,
} = wishlistApi;
