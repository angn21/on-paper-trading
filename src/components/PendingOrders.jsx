import { formatCurrency } from '../lib/formatters';
import { usePortfolio } from '../hooks/usePortfolio';

export default function PendingOrders({ orders }) {
  const { cancelPendingOrder } = usePortfolio();

  if (!orders?.length) return null;

  return (
    <div className="card">
      <h2 className="card-title">Pending orders</h2>
      <ul className="pending-orders">
        {orders.map((order) => (
          <li key={order.id} className="pending-order-row">
            <div>
              <strong>{order.side.toUpperCase()}</strong> {order.shares} {order.symbol}
              <span className="order-type-badge">{order.orderType}</span>
              {order.limitPrice != null && ` @ ${formatCurrency(order.limitPrice)}`}
              {order.stopPrice != null && ` stop ${formatCurrency(order.stopPrice)}`}
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => cancelPendingOrder(order.id)}>
              Cancel
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
