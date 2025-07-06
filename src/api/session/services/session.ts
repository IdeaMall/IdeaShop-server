import { createDecipheriv } from 'crypto';
import { verify, type JsonWebTokenError } from 'jsonwebtoken';
import { ParameterizedContext } from 'koa';
import { buildURLData } from 'web-utility';

const { WMA_ID, WMA_KEY } = process.env;

export type JWTContext<T> = ParameterizedContext<
  { jwtOriginalError: JsonWebTokenError } | { user: T }
>;
export interface WechatSession
  extends Record<'openid' | 'session_key' | 'errmsg', string> {
  unionid?: string;
  errcode: number;
}
export type WechatCryptedData = Record<'encryptedData' | 'iv', string>;

interface DecryptData {
  watermark: { appid: string; timestamp: number };
}
export type PhoneDecryptData = DecryptData &
  Record<'phoneNumber' | 'purePhoneNumber' | 'countryCode', string>;

export class SessionService {
  decodeJWT<T extends WechatSession>({ request }: JWTContext<T>) {
    return verify(
      request.header.authorization.split(/\s+/)[1],
      strapi.config.get('plugin::users-permissions.jwtSecret'),
    ) as T;
  }

  /**
   * @see https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/login/auth.code2Session.html
   */
  async getWechatSession(code: string) {
    const response = await fetch(
      `https://api.weixin.qq.com/sns/jscode2session?${buildURLData({
        appid: WMA_ID,
        secret: WMA_KEY,
        js_code: code,
        grant_type: 'authorization_code',
      })}`,
    );
    const { errcode, errmsg, ...data } =
      (await response.json()) as WechatSession;

    if (errcode) throw new URIError(errmsg);

    return data;
  }

  decrypt<T extends DecryptData = DecryptData>(
    encryptedData: string,
    iv: string,
    sessionKey: string,
  ) {
    const encrypted = Buffer.from(encryptedData, 'base64'),
      session = Buffer.from(sessionKey, 'base64'),
      vector = Buffer.from(iv, 'base64');

    const decipher = createDecipheriv('aes-128-cbc', session, vector);
    decipher.setAutoPadding(true);
    // @ts-expect-error Type compatibility bug
    let decoded = decipher.update(encrypted, 'binary', 'utf8') as string;
    decoded += decipher.final('utf8');

    const data = JSON.parse(decoded) as T;

    if (data.watermark.appid !== WMA_ID) throw new Error('Illegal Buffer');

    return data;
  }
}
export default () => new SessionService();
