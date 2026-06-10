import { useEffect, useMemo, useState } from 'react';
import { authApi, merchantApi } from '@jingpai/shared';
import {
  BadgeCheck,
  CalendarDays,
  Coins,
  Gavel,
  Mail,
  Package,
  Phone,
  Radio,
  ShieldCheck,
  Store,
  UserRound,
} from 'lucide-react';

interface MerchantProfile {
  id: number;
  phone?: string;
  email?: string;
  nickname: string;
  avatarUrl?: string;
  role: 'USER' | 'MERCHANT';
  createdAt: string;
}

interface MerchantStats {
  productCount: number;
  activeAuctions: number;
  completedAuctions: number;
  totalOrders: number;
  paidOrders: number;
  totalRevenue: number;
  liveRooms: number;
}

const metricCardClass =
  'bg-white border border-zinc-200/80 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-zinc-300/80 transition duration-300';

function maskPhone(phone?: string) {
  if (!phone) return '未绑定';
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [stats, setStats] = useState<MerchantStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    Promise.all([authApi.getProfile(), merchantApi.stats()])
      .then(([profileRes, statsRes]: any) => {
        if (!mounted) return;
        setProfile(profileRes.data);
        setStats(statsRes.data);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const metrics = useMemo(
    () =>
      stats
        ? [
            { label: '商品数', value: stats.productCount, icon: Package, hint: '当前可管理商品总量' },
            { label: '进行中竞拍', value: stats.activeAuctions, icon: Gavel, hint: '正在实时竞价的场次' },
            { label: '已成交竞拍', value: stats.completedAuctions, icon: BadgeCheck, hint: '已完成成交的竞拍场次' },
            { label: '总订单数', value: stats.totalOrders, icon: Store, hint: '累计产生的商家订单' },
            { label: '直播中', value: stats.liveRooms, icon: Radio, hint: '当前在线直播间数量' },
            {
              label: '累计营收',
              value: `¥${stats.totalRevenue.toLocaleString()}`,
              icon: Coins,
              hint: '基于已支付 / 已发货 / 已完成订单统计',
            },
          ]
        : [],
    [stats]
  );

  const initial = profile?.nickname?.charAt(0) || '商';

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">个人中心</h2>
        <p className="text-sm text-zinc-500 mt-1">查看商家资料与经营概览</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="text-sm text-zinc-400 font-medium animate-pulse">资料加载中...</div>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
            <div className="bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 text-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-start gap-5">
                <div className="w-18 h-18 min-w-[4.5rem] min-h-[4.5rem] rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-2xl font-bold backdrop-blur-sm">
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-2xl font-bold truncate">{profile?.nickname || '未命名商家'}</h3>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-medium">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      商家账号
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 mt-2 leading-6">
                    这里集中展示商家身份信息与基础经营数据，方便您快速返回订单、商品和直播相关管理页面。
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="flex items-center gap-2 text-zinc-300 text-sm">
                    <Phone className="w-4 h-4" />
                    联系手机
                  </div>
                  <div className="mt-2 text-base font-semibold">{maskPhone(profile?.phone)}</div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="flex items-center gap-2 text-zinc-300 text-sm">
                    <Mail className="w-4 h-4" />
                    联系邮箱
                  </div>
                  <div className="mt-2 text-base font-semibold break-all">{profile?.email || '未绑定'}</div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="flex items-center gap-2 text-zinc-300 text-sm">
                    <UserRound className="w-4 h-4" />
                    账号角色
                  </div>
                  <div className="mt-2 text-base font-semibold">{profile?.role === 'MERCHANT' ? '商家' : '普通用户'}</div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="flex items-center gap-2 text-zinc-300 text-sm">
                    <CalendarDays className="w-4 h-4" />
                    注册时间
                  </div>
                  <div className="mt-2 text-base font-semibold">
                    {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '暂无记录'}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm space-y-5">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">经营概览</h3>
                <p className="text-sm text-zinc-500 mt-1">快速了解店铺当前的经营状态与营收表现</p>
              </div>

              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-emerald-700">累计营收</div>
                    <div className="mt-2 text-3xl font-bold tracking-tight text-emerald-950">
                      ¥{stats?.totalRevenue?.toLocaleString() || '0'}
                    </div>
                    <p className="mt-2 text-xs text-emerald-700/80 leading-5">
                      统计口径为已支付、已发货、已完成订单的累计成交金额。
                    </p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-white text-emerald-600 flex items-center justify-center shadow-sm">
                    <Coins className="w-7 h-7" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
                  <div className="text-zinc-500">总订单数</div>
                  <div className="mt-2 text-2xl font-bold text-zinc-900">{stats?.totalOrders || 0}</div>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
                  <div className="text-zinc-500">已支付订单</div>
                  <div className="mt-2 text-2xl font-bold text-zinc-900">{stats?.paidOrders || 0}</div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">经营数据</h3>
                <p className="text-sm text-zinc-500 mt-1">基于现有商家统计接口展示的核心指标</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {metrics.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className={metricCardClass}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-zinc-500">{item.label}</span>
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-700 flex items-center justify-center">
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="mt-4 text-3xl font-bold tracking-tight text-zinc-900">{item.value}</div>
                    <p className="mt-2 text-xs text-zinc-400 leading-5">{item.hint}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
