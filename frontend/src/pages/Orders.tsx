import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { baht, dateTime, ORDER_STATUS_LABEL, ORDER_STATUS_STYLE } from '../lib/format';
import type { Order } from '../lib/types';

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Order[]>('/orders').then(setOrders).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">My orders</h1>

      {error && <p className="text-red-600">{error}</p>}
      {!orders && !error && <p className="text-gray-500">Loading…</p>}

      {orders && orders.length === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <Package className="w-14 h-14 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 mb-6">You haven't placed any orders yet.</p>
          <Link to="/products" className="px-6 py-2.5 bg-orange-gradient text-white rounded-full font-semibold text-sm">
            Browse beetles
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {orders?.map((o) => (
          <Link
            key={o.id}
            to={`/orders/${o.id}`}
            className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 p-5 hover:border-orange/40 hover:shadow-md transition-all"
          >
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-mono font-semibold text-gray-900">{o.order_number}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ORDER_STATUS_STYLE[o.status]}`}>
                  {ORDER_STATUS_LABEL[o.status]}
                </span>
              </div>
              <p className="text-sm text-gray-500 truncate">
                {dateTime(o.created_at)} · {o.order_items.map((i) => `${i.product_name} ×${i.quantity}`).join(', ')}
              </p>
              {o.tracking_number && (
                <p className="text-xs text-gray-500 mt-1">
                  {o.carrier}: <span className="font-mono">{o.tracking_number}</span>
                </p>
              )}
            </div>
            <span className="font-bold text-gray-900">{baht(o.total)}</span>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Orders;
