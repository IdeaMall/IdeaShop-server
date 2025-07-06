import { WechatUser } from '../../session/controllers/session';
import { JWTContext, SessionService } from '../../session/services/session';
import { MyOrderService } from '../services/my-order';

class MyOrderController {
  get sessionService() {
    return strapi.service('api::session.session') as SessionService;
  }
  get orderService() {
    return strapi.service('api::my-order.my-order') as MyOrderService;
  }

  create(context: JWTContext<WechatUser>) {
    const { documentId } = this.sessionService.decodeJWT(context);

    return this.orderService.create(documentId, context.request.body.data);
  }
}

export default new MyOrderController();
