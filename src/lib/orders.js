/** Check if a pending stock order should fill at the current price. */
export function shouldFillOrder(order, price) {
  if (!price || price <= 0) return false;

  if (order.orderType === 'limit') {
    if (order.side === 'buy') return price <= order.limitPrice;
    return price >= order.limitPrice;
  }

  if (order.orderType === 'stop') {
    if (order.side === 'buy') return price >= order.stopPrice;
    return price <= order.stopPrice;
  }

  return false;
}
