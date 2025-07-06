import { Context } from 'koa';

import { JWTContext, SessionService } from '../../session/services/session';
import { WechatUser } from '../../session/controllers/session';
import { PaymentService } from '../services/payment';

class PaymentController {
  get sessionService() {
    return strapi.service('api::session.session') as SessionService;
  }
  get paymentService() {
    return strapi.service('api::payment.payment') as PaymentService;
  }
  get orderStore() {
    return strapi.documents('api::order.order');
  }

  payOrderInWechat(
    context: JWTContext<WechatUser> & { params: { orderId: string } },
  ) {
    const { wechatId } = this.sessionService.decodeJWT(context);

    return this.paymentService.payOrderInWechat(
      wechatId,
      context.params.orderId,
    );
  }

  async finishOrderInWechat(context: Context) {
    try {
      await this.paymentService.finishWechatTransaction(context);
    } catch (error) {
      console.error(error);
      try {
        await this.paymentService.finishWechatTransactions();
        return '';
      } catch (error) {
        console.error(error);

        context.status = 400;
        context.body = { code: 'FAIL', message: error.message };
      }
    }
  }
}

export default new PaymentController();
