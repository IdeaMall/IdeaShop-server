import {
  ApiSkuSku,
  ApiOrderOrder,
  ApiCouponLogCouponLog,
} from '../../../../types/generated/contentTypes';
import { CollectionType } from '../../../utility';
import { MyCouponService } from '../../my-coupon/services/my-coupon';

export class MyOrderService {
  get skuStore() {
    return strapi.documents('api::sku.sku');
  }
  get couponLogStore() {
    return strapi.documents('api::coupon-log.coupon-log');
  }
  get couponCodeService() {
    return strapi.service('api::my-coupon.my-coupon') as MyCouponService;
  }
  get orderStore() {
    return strapi.documents('api::order.order');
  }

  async checkSkuStock(documentId: string) {
    const sku = await this.skuStore.findOne({ documentId, populate: '*' });

    const payedOrders = await this.orderStore.count({
      filters: { skus: { documentId }, accountId: { $notNull: true } },
    });
    sku.stock = payedOrders;

    if (1 + sku.stock > sku.amount)
      throw new RangeError(
        `SKU "${sku.name}" has reached its maximum capacity`,
      );
    return sku as CollectionType<ApiSkuSku>;
  }

  async create(userId: string, orderInput: CollectionType<ApiOrderOrder>) {
    orderInput.payer = { documentId: userId };

    const coupons = await Promise.all(
      (orderInput.coupons as string[]).map((documentId) =>
        this.couponLogStore.findOne({ documentId }),
      ),
    );
    const skus = await Promise.all(
      (orderInput.skus as string[]).map((sku) => this.checkSkuStock(sku)),
    );
    orderInput.price = 0;

    for (const sku of skus) {
      const { totalPrice } = await this.couponCodeService.batchVerify(
        coupons as CollectionType<ApiCouponLogCouponLog>[],
        sku,
        1,
      );
      orderInput.price += totalPrice;
    }
    console.table(orderInput);

    const orderOutput = await this.orderStore.create({
      data: orderInput,
      populate: '*',
    });
    for (const { documentId, ...data } of skus)
      await this.skuStore.update({ documentId, data });

    return orderOutput;
  }
}

export default () => new MyOrderService();
