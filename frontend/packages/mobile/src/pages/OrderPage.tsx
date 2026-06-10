import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Order, orderApi, conversationApi } from '@jingpai/shared';

const statusConfig: Record<string, { label: string; color: string; desc: string }> = {
  PENDING_PAYMENT: { label: '待付款', color: 'text-yellow-400', desc: '请在30分钟内完成支付' },
  PAID: { label: '已付款', color: 'text-blue-400', desc: '等待商家发货' },
  SHIPPED: { label: '已发货', color: 'text-indigo-400', desc: '商品已发出，请注意查收' },
  COMPLETED: { label: '已完成', color: 'text-green-400', desc: '交易完成' },
  CANCELLED: { label: '已取消', color: 'text-gray-400', desc: '订单已取消' },
};

export default function OrderPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchOrder = () => {
    if (!orderId) return;
    orderApi.get(Number(orderId)).then((res: any) => setOrder(res.data));
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const handlePay = async () => {
    if (!order) return;
    setLoading(true);
    try {
      await orderApi.pay(order.id);
      fetchOrder();
    } catch (err: any) {
      alert(err?.msg || '支付失败');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!order || !confirm('确认收货？')) return;
    setLoading(true);
    try {
      await orderApi.confirm(order.id);
      fetchOrder();
    } catch (err: any) {
      alert(err?.msg || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!order || !confirm('确定取消订单？')) return;
    setLoading(true);
    try {
      await orderApi.cancel(order.id);
      fetchOrder();
    } catch (err: any) {
      alert(err?.msg || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleContactMerchant = async () => {
    if (!order) return;
    try {
      const res: any = await conversationApi.create(order.sellerId);
      navigate(`/messages/${res.data.id}`);
    } catch (err: any) {
      alert(err?.msg || '发起私聊失败');
    }
  };

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  const status = statusConfig[order.status] || statusConfig.CANCELLED;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur-lg border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 text-lg">&larr;</button>
        <h1 className="text-lg font-bold">订单详情</h1>
      </header>

      {/* Status banner */}
      <div className="px-4 py-6 border-b border-gray-800 text-center">
        <div className={`text-2xl font-bold ${status.color}`}>{status.label}</div>
        <div className="text-sm text-gray-400 mt-1">{status.desc}</div>
      </div>

      {/* Order info */}
      <div className="px-4 py-4 space-y-3 border-b border-gray-800">
        <div className="flex justify-between">
          <span className="text-gray-400">订单号</span>
          <span className="font-mono text-sm">{order.orderNo}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">商品</span>
          <span>{order.product?.title || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">成交价</span>
          <span className="text-orange-400 font-bold text-lg">¥{order.finalPrice}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">下单时间</span>
          <span className="text-sm">{new Date(order.createdAt).toLocaleString()}</span>
        </div>
        {order.status === 'PENDING_PAYMENT' && (
          <div className="flex justify-between">
            <span className="text-gray-400">支付截止</span>
            <span className="text-sm text-red-400">
              {new Date(order.expireTime).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      <div className="px-4 py-4 border-b border-gray-800">
        <button
          type="button"
          onClick={handleContactMerchant}
          className="w-full py-3 rounded-2xl bg-gray-900 border border-gray-800 text-gray-100 text-sm font-medium"
        >
          联系商家
        </button>
      </div>

      {/* Actions */}
      <div className="px-4 py-6 space-y-3">
        {order.status === 'PENDING_PAYMENT' && (
          <>
            <button
              onClick={handlePay}
              disabled={loading}
              className="w-full py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 disabled:opacity-50 transition"
            >
              立即支付
            </button>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="w-full py-3 bg-gray-800 text-gray-300 rounded-xl hover:bg-gray-700 disabled:opacity-50 transition"
            >
              取消订单
            </button>
          </>
        )}
        {order.status === 'SHIPPED' && (
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="w-full py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 disabled:opacity-50 transition"
          >
            确认收货
          </button>
        )}
      </div>
    </div>
  );
}
