export default {
  routes: [
    {
      method: 'PUT',
      path: '/my-coupons/:code',
      handler: 'my-coupon.createWithCode',
      config: { auth: false },
    },
  ],
};
