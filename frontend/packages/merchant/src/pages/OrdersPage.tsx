import { useEffect, useState } from 'react';
import { Order, orderApi } from '@jingpai/shared';

const statusLabels: Record<string, { label: string; color: string }> = {
  PENDING_PAYMENT: { label: '待付款', color: 'bg-yellow-100 text-yellow-700' },
  PAID: { label: '已付款', color: 'bg-blue-100 text-blue-600' },
  SHIPPED: { label: '已发货', color: 'bg-indigo-100 text-indigo-600' },
  COMPLETED: { label: '已完成', color: 'bg-green-100 text-green-600' },
  CANCELLED: { label: '已取消', color: 'bg-gray-100 text-gray-500' },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOrders = () => {
    orderApi.merchantList().then((res: any) => setOrders(res.data || []));
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleShip = async (id: number) => {
    if (!confirm('确认发货？')) return;
    setLoading(true);
    try {
      await orderApi.ship(id);
      fetchOrders();
    } catch (err: any) {
      alert(err?.msg || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">订单管理</h2>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-6 py-3 text-sm text-gray-500 font-medium">订单号</th>
              <th className="text-left px-6 py-3 text-sm text-gray-500 font-medium">商品</th>
              <th className="text-left px-6 py-3 text-sm text-gray-500 font-medium">成交价</th>
              <th className="text-left px-6 py-3 text-sm text-gray-500 font-medium">买家</th>
              <th className="text-left px-6 py-3 text-sm text-gray-500 font-medium">状态</th>
              <th className="text-left px-6 py-3 text-sm text-gray-500 font-medium">下单时间</th>
              <th className="text-left px-6 py-3 text-sm text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  暂无订单
                </td>
              </tr>
            )}
            {orders.map((order) => {
              const s = statusLabels[order.status] || statusLabels.CANCELLED;
              return (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-sm">{order.orderNo}</td>
                  <td className="px-6 py-4">{order.product?.title || '-'}</td>
                  <td className="px-6 py-4 font-medium text-orange-600 tabular-nums">
                    ¥{order.finalPrice}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    用户 #{order.buyerId}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${s.color}`}>
                      {s.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    {order.status === 'PAID' && (
                      <button
                        onClick={() => handleShip(order.id)}
                        disabled={loading}
                        className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
                      >
                        发货
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
