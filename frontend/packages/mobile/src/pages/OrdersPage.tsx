import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { orderApi } from '@jingpai/shared';

interface Order {
  id: number;
  orderNo: string;
  finalPrice: number;
  status: string;
  createdAt: string;
  auction?: { product?: { title?: string; images?: string[] } };
}

const statusMap: Record<string, { label: string; color: string }> = {
  PENDING_PAYMENT: { label: '待付款', color: 'text-orange-400' },
  PAID: { label: '已付款', color: 'text-blue-400' },
  SHIPPED: { label: '已发货', color: 'text-cyan-400' },
  COMPLETED: { label: '已完成', color: 'text-green-400' },
  CANCELLED: { label: '已取消', color: 'text-gray-400' },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    orderApi.list().then((res: any) => {
      setOrders(res.data || []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur-lg border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="text-gray-400 text-lg">&larr;</button>
        <h1 className="text-lg font-bold">我的订单</h1>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">加载中...</div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="text-4xl mb-3">📦</div>
          <div>暂无订单</div>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {orders.map((order) => {
            const s = statusMap[order.status] || statusMap.PENDING_PAYMENT;
            const productTitle = order.auction?.product?.title || '竞拍商品';
            const productImage = order.auction?.product?.images?.[0];
            return (
              <div
                key={order.id}
                className="bg-gray-900 rounded-xl p-4 border border-gray-800 active:bg-gray-800"
                onClick={() => navigate(`/order/${order.id}`)}
              >
                <div className="flex items-start gap-3">
                  {productImage ? (
                    <img src={productImage} className="w-14 h-14 rounded-lg object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gray-800 flex items-center justify-center text-2xl">🎁</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{productTitle}</div>
                    <div className="text-xs text-gray-500 mt-0.5">订单号: {order.orderNo}</div>
                  </div>
                  <span className={`text-xs font-medium ${s.color}`}>{s.label}</span>
                </div>
                <div className="mt-3 flex justify-between items-center">
                  <div className="text-orange-400 font-bold">¥{order.finalPrice.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">{order.createdAt?.slice(0, 16)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
