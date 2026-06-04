import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { merchantApi } from '@jingpai/shared';
import {
  Radio,
  Gavel,
  CheckCircle2,
  Package,
  FileSpreadsheet,
  Coins,
  ArrowUpRight,
  Tv,
  ClipboardList,
} from 'lucide-react';

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
        {
          label: '直播中',
          value: stats.liveRooms,
          icon: Radio,
          iconColor: 'text-red-600 bg-red-50',
          desc: '当前在线直播间',
        },
        {
          label: '进行中的竞拍',
          value: stats.activeAuctions,
          icon: Gavel,
          iconColor: 'text-amber-600 bg-amber-50',
          desc: '实时竞价中',
        },
        {
          label: '已成交竞拍',
          value: stats.completedAuctions,
          icon: CheckCircle2,
          iconColor: 'text-green-600 bg-green-50',
          desc: '竞拍成功场次',
        },
        {
          label: '商品数',
          value: stats.productCount,
          icon: Package,
          iconColor: 'text-blue-600 bg-blue-50',
          desc: '货架商品总量',
        },
        {
          label: '总订单数',
          value: stats.totalOrders,
          icon: FileSpreadsheet,
          iconColor: 'text-indigo-600 bg-indigo-50',
          desc: '所有交易订单',
        },
        {
          label: '累计营收',
          value: `¥${stats.totalRevenue.toLocaleString()}`,
          icon: Coins,
          iconColor: 'text-emerald-600 bg-emerald-50',
          desc: '总成交金额',
        },
      ]
    : [];

  const actions = [
    { to: '/rooms', label: '直播间管理', icon: Tv, desc: '新建及开播控制', color: 'text-red-600' },
    { to: '/products', label: '商品管理', icon: Package, desc: '录入与上架商品', color: 'text-blue-600' },
    { to: '/auctions', label: '竞拍管理', icon: Gavel, desc: '配置及开启竞拍', color: 'text-amber-600' },
    { to: '/orders', label: '订单管理', icon: ClipboardList, desc: '发货与模拟支付', color: 'text-indigo-600' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">控制台</h2>
          <p className="text-sm text-zinc-500 mt-1">这里是您店铺的实时数据概览</p>
        </div>
      </div>

      {!stats ? (
        <div className="flex items-center justify-center py-32">
          <div className="text-sm text-zinc-400 font-medium animate-pulse">数据加载中...</div>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="bg-white border border-zinc-200/80 rounded-xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-zinc-300/80 transition duration-300"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-semibold text-zinc-500">{card.label}</span>
                    <div className={`p-2.5 rounded-lg ${card.iconColor}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-3xl font-bold tracking-tight text-zinc-900">{card.value}</span>
                    <p className="text-xs text-zinc-400 mt-1.5 font-medium">{card.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="bg-white border border-zinc-200/80 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-zinc-900 mb-4">快捷入口</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.label}
                    to={action.to}
                    className="group relative block p-5 rounded-lg border border-zinc-100 bg-zinc-50/50 hover:bg-white hover:border-zinc-200 hover:shadow-sm transition duration-300"
                  >
                    <div className="flex justify-between items-start">
                      <div className={`p-2 rounded-md bg-white border border-zinc-200/60 ${action.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" />
                    </div>
                    <div className="mt-4">
                      <h4 className="text-sm font-bold text-zinc-800">{action.label}</h4>
                      <p className="text-xs text-zinc-400 mt-1 font-medium">{action.desc}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
