import type { Middleware } from 'koa';

import { PluginUsersPermissionsUser } from '../../../../types/generated/contentTypes';
import { CollectionType } from '../../../utility';
import {
  JWTContext,
  PhoneDecryptData,
  SessionService,
  WechatCryptedData,
  WechatSession,
} from '../services/session';

export type WechatUser = WechatSession &
  CollectionType<PluginUsersPermissionsUser> & {
    documentId: string;
  };

class SessionController {
  get jwtService() {
    return strapi.service('plugin::users-permissions.jwt');
  }
  get sessionService() {
    return strapi.service('api::session.session') as SessionService;
  }
  get userStore() {
    return strapi.documents('plugin::users-permissions.user');
  }

  readProfile: Middleware = (context: JWTContext<WechatUser>) =>
    this.sessionService.decodeJWT(context);

  saveProfile: Middleware = (context: JWTContext<WechatUser>) => {
    const { documentId = '' } =
        'user' in context.state ? context.state.user : {},
      data = context.request.body;

    return this.userStore.update({ documentId, data });
  };

  signInWeChatMiniApp: Middleware = async (context) => {
    const { unionid, openid, session_key } =
      await this.sessionService.getWechatSession(context.request.body.code);

    const user =
      (await this.userStore.findFirst({
        filters: { wechatId: { $eq: openid } },
      })) ||
      (await this.userStore.create({
        data: {
          username: `wechat-${openid}`,
          email: `${openid}@mp.weixin.qq.com`,
          wechatId: openid,
          role: 1,
          confirmed: true,
        },
      }));
    const token = await this.jwtService.issue({
      ...user,
      unionid,
      openid,
      session_key,
    });
    return { ...user, token };
  };

  saveWeChatProfile: Middleware = (context: JWTContext<WechatUser>) => {
    const { documentId = '', session_key } =
        this.sessionService.decodeJWT(context),
      { encryptedData, iv } = context.request.body as WechatCryptedData;

    const { purePhoneNumber } = this.sessionService.decrypt<PhoneDecryptData>(
      encryptedData,
      iv,
      session_key,
    );
    return this.userStore.update({
      documentId,
      data: { mobilePhone: purePhoneNumber },
    });
  };
}
export default new SessionController();
