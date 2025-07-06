export default {
  routes: [
    {
      method: 'GET',
      path: '/session',
      handler: 'session.readProfile',
    },
    {
      method: 'PUT',
      path: '/session',
      handler: 'session.saveProfile',
    },
    {
      method: 'POST',
      path: '/session/WeChat',
      handler: 'session.signInWeChatMiniApp',
    },
    {
      method: 'PUT',
      path: '/session/WeChat',
      handler: 'session.saveWeChatProfile',
    },
  ],
};
