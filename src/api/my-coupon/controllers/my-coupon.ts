import { WechatUser } from '../../session/controllers/session';
import { JWTContext, SessionService } from '../../session/services/session';
import { MyCouponService } from '../services/my-coupon';

class MyCouponController {
  get sessionService() {
    return strapi.service('api::session.session') as SessionService;
  }
  get couponCodeService() {
    return strapi.service('api::my-coupon.my-coupon') as MyCouponService;
  }

  createWithCode(context: JWTContext<WechatUser>) {
    const { documentId } = this.sessionService.decodeJWT(context);

    return this.couponCodeService.createWithCode(
      documentId,
      context.params.code,
    );
  }
}

export default new MyCouponController();
