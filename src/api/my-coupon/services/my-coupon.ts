import { CollectionType } from '../../../utility';
import {
  ApiCouponLogCouponLog,
  ApiSkuSku,
} from '../../../../types/generated/contentTypes';

export class MyCouponService {
  get couponStore() {
    return strapi.documents('api::coupon.coupon');
  }
  get couponLogStore() {
    return strapi.documents('api::coupon-log.coupon-log');
  }

  async createWithCode(userId: string, code: string) {
    const coupon = await this.couponStore.findFirst({
      filters: { code },
      populate: '*',
    });
    if (!coupon) throw new ReferenceError(`Coupon "${code}" doesn't exist`);

    const couponLogs = await this.couponLogStore.findMany({
      filters: { coupon: { code } },
      populate: '*',
    });
    if (couponLogs.find(({ user }) => user.documentId === userId))
      throw new RangeError(
        `Coupon "${coupon.name}" has already been taken by you`,
      );
    const stock = coupon.amount - couponLogs.length;

    if (stock <= 0)
      throw new RangeError(
        `Coupon "${coupon.name}" has reached its usage limit`,
      );
    const couponLogOutput = await this.couponLogStore.create({
      data: { user: { documentId: userId }, coupon },
    });
    await this.couponStore.update({
      documentId: coupon.documentId,
      data: { stock: stock - 1 },
    });
    return couponLogOutput as CollectionType<ApiCouponLogCouponLog>;
  }

  async batchVerify(
    couponLogs: CollectionType<ApiCouponLogCouponLog>[],
    { name, item, unitPrice }: CollectionType<ApiSkuSku>,
    amount: number,
  ) {
    const now = Date.now(),
      itemId = item?.documentId;

    for (const { order, coupon } of couponLogs)
      if (
        !order &&
        (!coupon.startedAt || +new Date(coupon.startedAt) <= now) &&
        (!coupon.endedAt || +new Date(coupon.endedAt) >= now) &&
        (!coupon.items?.length ||
          coupon.items.some(({ documentId }) => documentId === itemId))
      )
        throw new Error(`Coupon "${coupon.name}" is invalid for sku "${name}"`);

    couponLogs.sort(
      ({ coupon: a }, { coupon: b }) => b.thresholdPrice - a.thresholdPrice,
    );
    let totalPrice = unitPrice * amount;
    const usedCoupons: string[] = [];

    for (const { documentId, coupon } of couponLogs)
      if (coupon.thresholdPrice <= totalPrice) {
        totalPrice -= coupon.deductPrice;

        usedCoupons.push(documentId);
      }
    totalPrice = +totalPrice.toFixed(2);

    return { usedCoupons, totalPrice };
  }
}

export default () => new MyCouponService();
