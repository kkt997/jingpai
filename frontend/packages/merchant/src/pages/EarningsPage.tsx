import { useEffect, useMemo, useState } from 'react';
import { Order, orderApi, merchantApi } from '@jingpai/shared';
import {
  CircleDollarSign,
  Coins,
  FileSpreadsheet,
} from 'lucide-react';

interface MerchantStats {
  productCount: number;
  activeAuctions: number;
  completedAuctions: number;
  totalOrders: number;
  paidOrders: number;
  totalRevenue: number;
  liveRooms: number;
}

const revenueStatuses = new Set(['PAID', 'SHIPPED', 'COMPLETED']);

const statusLabels: Record<string, { label: string; color: string }> = {
  PENDING_PAYMENT: { label: '待付款', color: 'bg-yellow-100 text-yellow-700' },
  PAID: { label: '已付款', color: 'bg-blue-100 text-blue-600' },
  SHIPPED: { label: '已发货', color: 'bg-indigo-100 text-indigo-600' },
  COMPLETED: { label: '已完成', color: 'bg-green-100 text-green-600' },
  CANCELLED: { label: '已取消', color: 'bg-gray-100 text-gray-500' },
};

export default function EarningsPage() {
  const [stats, setStats] = useState<MerchantStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    Promise.all([merchantApi.stats(), orderApi.merchantList()])
      .then(([statsRes, ordersRes]: any) => {
        if (!mounted) return;
        setStats(statsRes.data);
        setOrders(ordersRes.data || []);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const revenueOrders = useMemo(
    () => orders.filter((order) => revenueStatuses.has(order.status)),
    [orders]
  );

  const latestRevenueOrders = useMemo(() => revenueOrders.slice(0, 8), [revenueOrders]);

  const averageRevenue = useMemo(() => {
    if (!stats?.paidOrders) return 0;
    return stats.totalRevenue / stats.paidOrders;
  }, [stats]);

  const summaryCards = stats
    ? [
        {
          label: '累计营收',
          value: `¥${stats.totalRevenue.toLocaleString()}`,
          desc: '来自已支付 / 已发货 / 已完成订单',
          icon: Coins,
          tone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        },
        {
          label: '收入订单数',
          value: stats.paidOrders,
          desc: '当前计入营收统计的订单笔数',
          icon: FileSpreadsheet,
          tone: 'bg-blue-50 text-blue-700 border-blue-100',
        },
        {
          label: '单笔平均成交',
          value: `¥${averageRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
          desc: '按当前收入订单计算的平均成交金额',
          icon: CircleDollarSign,
          tone: 'bg-amber-50 text-amber-700 border-amber-100',
        },
      ]
    : [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">收益中心</h2>
        <p className="text-sm text-zinc-500 mt-1">查看累计营收、收入订单与最近成交明细</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="text-sm text-zinc-400 font-medium animate-pulse">收益数据加载中...</div>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">收益概览</h3>
                  <p className="text-sm text-zinc-500 mt-1">当前页面展示的是营收与成交数据，不代表可提现余额。</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Coins className="w-6 h-6" />
                </div>
              </div>

              <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-6">
                <div className="text-sm font-medium text-emerald-50/90">累计营收</div>
                <div className="mt-3 text-4xl font-bold tracking-tight">
                  ¥{stats?.totalRevenue?.toLocaleString() || '0'}
                </div>
                <p className="mt-3 text-sm text-emerald-50/90 leading-6">
                  统计口径为商家已支付、已发货、已完成订单的累计成交金额，不包含余额、提现与待结算维度。
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {summaryCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.label} className={`rounded-xl border p-4 ${card.tone}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold">{card.label}</span>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="mt-4 text-2xl font-bold tracking-tight">{card.value}</div>
                      <p className="mt-2 text-xs leading-5 opacity-80">{card.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm space-y-5">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">经营关联数据</h3>
                <p className="text-sm text-zinc-500 mt-1">帮助判断营收来源与当前成交活跃度</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
                  <div className="text-sm text-zinc-500">总订单数</div>
                  <div className="mt-2 text-3xl font-bold text-zinc-900">{stats?.totalOrders || 0}</div>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
                  <div className="text-sm text-zinc-500">已成交竞拍</div>
                  <div className="mt-2 text-3xl font-bold text-zinc-900">{stats?.completedAuctions || 0}</div>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
                  <div className="text-sm text-zinc-500">商品数</div>
                  <div className="mt-2 text-3xl font-bold text-zinc-900">{stats?.productCount || 0}</div>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
                  <div className="text-sm text-zinc-500">直播中</div>
                  <div className="mt-2 text-3xl font-bold text-zinc-900">{stats?.liveRooms || 0}</div>
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 p-4 text-sm text-zinc-500 leading-6">
                当前后端尚未提供“可提现余额 / 待结算 / 提现记录”等资金账户能力，因此本页仅展示可明确复用的营收与成交数据。
              </div>
            </div>
          </section>

          <section className="bg-white border border-zinc-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">最近收入明细</h3>
                <p className="text-sm text-zinc-500 mt-1">展示最近计入营收统计的订单记录</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-500 font-medium">
                共 {revenueOrders.length} 笔收入订单
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm text-zinc-500 font-medium">订单号</th>
                    <th className="text-left px-6 py-3 text-sm text-zinc-500 font-medium">商品</th>
                    <th className="text-left px-6 py-3 text-sm text-zinc-500 font-medium">订单状态</th>
                    <th className="text-left px-6 py-3 text-sm text-zinc-500 font-medium">成交金额</th>
                    <th className="text-left px-6 py-3 text-sm text-zinc-500 font-medium">下单时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {latestRevenueOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 text-sm">
                        暂无可展示的收入记录
                      </td>
                    </tr>
                  ) : (
                    latestRevenueOrders.map((order) => {
                      const status = statusLabels[order.status] || statusLabels.CANCELLED;
                      return (
                        <tr key={order.id} className="hover:bg-zinc-50/70 transition">
                          <td className="px-6 py-4 font-mono text-sm text-zinc-700">{order.orderNo}</td>
                          <td className="px-6 py-4 text-sm text-zinc-800">{order.product?.title || '-'}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-emerald-600 tabular-nums">
                            ¥{order.finalPrice.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-500">
                            {new Date(order.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
