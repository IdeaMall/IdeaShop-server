export default {
  routes: [
    {
      method: 'PUT',
      path: '/payments/:orderId/WeChat',
      handler: 'payment.payOrderInWechat',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/payments/WeChat',
      handler: 'payment.finishOrderInWechat',
      config: { auth: false },
    },
  ],
};
