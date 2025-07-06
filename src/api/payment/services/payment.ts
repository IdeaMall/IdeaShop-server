import { readFileSync } from 'fs';
import { Context } from 'koa';
import { formatDate } from 'web-utility';
import WechatPay from 'wechatpay-node-v3';

const { NODE_ENV, SERVER_URL, WMA_ID, WPM_ID, WPM_KEY } = process.env;

const ServerHost =
  NODE_ENV === 'production' ? SERVER_URL : 'http://localhost:1337';

type WechatPaymentRequest = Record<
  | 'appId'
  | 'timeStamp'
  | 'nonceStr'
  | 'package'
  | 'signType'
  | 'paySign'
  | 'prepayId',
  string
>;

type WechatPaymentRawResponse = Record<
  'id' | 'create_time' | 'summary',
  string
> & {
  resource_type: 'encrypt-resource';
  event_type: `TRANSACTION.${'SUCCESS'}`;
  resource: {
    original_type: 'transaction';
    algorithm: 'AEAD_AES_256_GCM';
  } & Record<'ciphertext' | 'associated_data' | 'nonce', string>;
};

type WechatPaymentResponse = Record<
  | 'appid'
  | 'mchid'
  | 'out_trade_no'
  | 'transaction_id'
  | 'trade_state_desc'
  | 'attach'
  | 'success_time',
  string
> & {
  trade_type: 'NATIVE';
  trade_state: 'SUCCESS';
  bank_type: 'OTHERS';
  payer: { openid: string };
  amount: Record<`${'' | 'payer_'}total`, number> &
    Record<`${'' | 'payer_'}currency`, 'CNY'>;
};

export class PaymentService {
  get orderStore() {
    return strapi.documents('api::order.order');
  }

  wechatPay = new WechatPay({
    appid: WMA_ID,
    mchid: WPM_ID,
    publicKey: readFileSync('apiclient_cert.pem'),
    privateKey: readFileSync('apiclient_key.pem'),
    key: WPM_KEY,
  });

  async payInWechat(
    openid: string,
    description: string,
    cashAmount: number,
    out_trade_no: string,
  ) {
    const { status, error, errRaw, data } =
      await this.wechatPay.transactions_jsapi({
        payer: { openid },
        description,
        amount: { total: +(cashAmount * 100).toFixed(0) },
        out_trade_no,
        notify_url: new URL('api/payments/WeChat', ServerHost) + '',
      });

    if (error) {
      console.table({ status, errRaw });

      throw new URIError(error);
    }
    const [, prepayId] = (data as WechatPaymentRequest).package.split('=');

    return { ...data, prepayId } as WechatPaymentRequest;
  }

  async payOrderInWechat(openid: string, orderId: string) {
    const { documentId, skus, price } = await this.orderStore.findOne({
      documentId: orderId,
      populate: '*',
    });
    const description = `${skus[0]?.item?.name}（${skus[0]?.name}）等 ${skus.length} 件商品`;

    const { prepayId, ...payment } = await this.payInWechat(
      openid,
      description,
      price,
      documentId,
    );
    await this.orderStore.update({ documentId, data: { paymentId: prepayId } });

    return payment;
  }

  async finishWechatTransaction({ request, headers }: Context) {
    const body = request.body as WechatPaymentRawResponse;

    const verifed = await this.wechatPay.verifySign({
      body,
      signature: headers['wechatpay-signature'] + '',
      serial: headers['wechatpay-serial'] + '',
      nonce: headers['wechatpay-nonce'] + '',
      timestamp: headers['wechatpay-timestamp'] + '',
      apiSecret: WPM_KEY,
    });

    if (!verifed) throw new Error('Wechat payment signature is invalid');

    const { ciphertext, associated_data, nonce } = body.resource;

    const { out_trade_no, transaction_id } =
      this.wechatPay.decipher_gcm<WechatPaymentResponse>(
        ciphertext,
        associated_data,
        nonce,
        WPM_KEY,
      );
    return this.orderStore.update({
      documentId: out_trade_no,
      data: { accountId: transaction_id },
    });
  }

  async finishWechatTransactions() {
    const unfinishedOrders = await this.orderStore.findMany({
      filters: { accountId: { $null: true } },
    });

    for (const { documentId } of unfinishedOrders) {
      const { status, error, errRaw, data } = await this.wechatPay.query({
        out_trade_no: documentId,
      });

      if (error) {
        console.table({ documentId, status, error, errRaw });
        continue;
      }
      const { trade_state, transaction_id } = data as WechatPaymentResponse;

      if (trade_state === 'SUCCESS')
        await this.orderStore.update({
          documentId,
          data: { accountId: transaction_id },
        });
      else console.table(data);
    }
  }
}

export default () => new PaymentService();
