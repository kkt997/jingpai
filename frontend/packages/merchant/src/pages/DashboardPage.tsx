import { useEffect, useState } from 'react';
import { merchantApi } from '@jingpai/shared';

interface Stats {
  productCount: number;
  activeAuctions: number;
  completedAuctions: number;
  totalOrders: number;
  paidOrders: number;
  totalRevenue: number;
  liveRooms: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    merchantApi.stats().then((res: any) => setStats(res.data));
  }, []);

  const cards = stats
    ? [
        { label: '直播中', value: stats.liveRooms, icon: '📡', color: 'from-red-500 to-orange-500' },
        { label: '进行中的竞拍', value: stats.activeAuctions, icon: '🔨', color: 'from-green-500 to-emerald-500' },
        { label: '已成交竞拍', value: stats.completedAuctions, icon: '✅', color: 'from-purple-500 to-indigo-500' },
        { label: '商品数', value: stats.productCount, icon: '📦', color: 'from-blue-500 to-cyan-500' },
        { label: '总订单数', value: stats.totalOrders, icon: '📋', color: 'from-yellow-500 to-amber-500' },
        { label: '累计营收', value: `¥${stats.totalRevenue.toLocaleString()}`, icon: '💰', color: 'from-pink-500 to-rose-500' },
      ]
    : [];

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">仪表盘</h2>

      {!stats ? (
        <div className="text-center py-20 text-gray-400">加载中...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {cards.map((card) => (
              <div
                key={card.label}
                className={`bg-gradient-to-br ${card.color} rounded-xl p-5 text-white shadow-lg`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm opacity-80">{card.label}</div>
                    <div className="text-3xl font-bold mt-1">{card.value}</div>
                  </div>
                  <div className="text-3xl">{card.icon}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-bold text-gray-700 mb-3">快速操作</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <a href="/rooms" className="block p-4 rounded-lg bg-gray-50 hover:bg-gray-100 text-center transition">
                <div className="text-2xl mb-1">📡</div>
                <div className="text-sm text-gray-700">直播间管理</div>
              </a>
              <a href="/products" className="block p-4 rounded-lg bg-gray-50 hover:bg-gray-100 text-center transition">
                <div className="text-2xl mb-1">📦</div>
                <div className="text-sm text-gray-700">商品管理</div>
              </a>
              <a href="/auctions" className="block p-4 rounded-lg bg-gray-50 hover:bg-gray-100 text-center transition">
                <div className="text-2xl mb-1">🔨</div>
                <div className="text-sm text-gray-700">竞拍管理</div>
              </a>
              <a href="/orders" className="block p-4 rounded-lg bg-gray-50 hover:bg-gray-100 text-center transition">
                <div className="text-2xl mb-1">📋</div>
                <div className="text-sm text-gray-700">订单管理</div>
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
