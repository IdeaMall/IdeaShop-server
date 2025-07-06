export default {
  routes: [
    {
      method: 'POST',
      path: '/my-orders',
      handler: 'my-order.create',
      config: { auth: false },
    },
  ],
};
