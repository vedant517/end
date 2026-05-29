import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '../../services/apiConfig';

export const orderApi = createApi({
  reducerPath: 'orderApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    credentials: 'include',
  }),
  tagTypes: ['Order', 'OrderStats'],
  endpoints: (builder) => ({
    getOrders: builder.query({
      query: (status) => (status ? `/admin/orders?status=${status}` : '/admin/orders'),
      providesTags: (result) =>
        result?.data
          ? [
            ...result.data.map(({ orderId }) => ({ type: 'Order', id: orderId })),
            { type: 'Order', id: 'LIST' },
          ]
          : [{ type: 'Order', id: 'LIST' }],
    }),
    getOrderStats: builder.query({
      query: () => '/admin/orders/stats',
      providesTags: ['OrderStats'],
    }),
    updateOrderStatus: builder.mutation({
      query: ({ orderId, status }) => ({
        url: `/admin/orders/${orderId}`,
        method: 'PUT',
        body: { status },
      }),
      invalidatesTags: (result, error, { orderId }) => [
        { type: 'Order', id: orderId },
        { type: 'Order', id: 'LIST' },
        'OrderStats',
      ],
    }),
    updateShippingInfo: builder.mutation({
      query: ({ orderId, ...shippingData }) => ({
        url: `/orders/${orderId}/shipping`,
        method: 'PUT',
        body: shippingData,
      }),
      invalidatesTags: (result, error, { orderId }) => [
        { type: 'Order', id: orderId },
        { type: 'Order', id: 'LIST' },
        'OrderStats',
      ],
    }),
    calculateShippingCharge: builder.mutation({
      query: (amount) => ({
        url: '/shipping/calculate',
        method: 'POST',
        body: { amount },
      }),
    }),
    createOrder: builder.mutation({
      query: (orderData) => ({
        url: '/orders',
        method: 'POST',
        body: orderData,
      }),
      invalidatesTags: ['Order', 'OrderStats'],
    }),

    getUserOrders: builder.query({
      query: () => '/orders/my-orders',
      providesTags: (result) =>
        result?.data
          ? [
            ...result.data.map(({ orderId }) => ({ type: 'Order', id: orderId })),
            { type: 'Order', id: 'LIST' },
          ]
          : [{ type: 'Order', id: 'LIST' }],
    }),
      cancelOrder: builder.mutation({
        query: (params) => {
          const { orderId, reason } = typeof params === 'string' ? { orderId: params, reason: undefined } : params || {};
          return {
            url: `/orders/cancel/${orderId}`,
            method: 'POST',
            body: { reason },
          };
        },
        invalidatesTags: (result, error, { orderId }) => [
          { type: 'Order', id: orderId },
          { type: 'Order', id: 'LIST' },
          'OrderStats',
        ],
      }),
  }),
});

export const {
  useGetOrdersQuery,
  useGetOrderStatsQuery,
  useUpdateOrderStatusMutation,
  useCreateOrderMutation,
  useUpdateShippingInfoMutation,
  useCalculateShippingChargeMutation,
  useGetUserOrdersQuery,
  useCancelOrderMutation,
} = orderApi;
