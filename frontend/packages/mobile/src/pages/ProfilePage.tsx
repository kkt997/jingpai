import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { depositApi, userApi, Deposit } from '@jingpai/shared';

export default function ProfilePage() {
  const { user, logout, loadProfile } = useAuthStore();
  const navigate = useNavigate();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [showDeposits, setShowDeposits] = useState(false);
  const [balanceInput, setBalanceInput] = useState('');
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [walletMsg, setWalletMsg] = useState('');

  useEffect(() => {
    loadProfile();
    depositApi.list().then((res: any) => setDeposits(res.data || []));
  }, []);

  const frozenAmount = deposits
    .filter((d) => d.status === 'FROZEN')
    .reduce((sum, d) => sum + Number(d.amount || 0), 0);

  const settledAmount = deposits
    .filter((d) => d.status === 'DEDUCTED')
    .reduce((sum, d) => sum + Number(d.amount || 0), 0);

  const totalRefunded = deposits
    .filter((d) => d.status === 'REFUNDED')
    .reduce((sum, d) => sum + Number(d.amount || 0), 0);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleSwitchAccount = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleSetBalance = async () => {
    const nextBalance = Number(balanceInput);
    if (balanceInput.trim() === '' || Number.isNaN(nextBalance) || nextBalance < 0) {
      setWalletMsg('请输入不小于 0 的余额');
      return;
    }

    setBalanceLoading(true);
    setWalletMsg('');
    try {
      await userApi.setBalance(nextBalance);
      await loadProfile();
      setBalanceInput('');
      setWalletMsg('余额已更新');
    } catch (err: any) {
      setWalletMsg(err?.msg || '设置余额失败');
    } finally {
      setBalanceLoading(false);
    }
  };

  const statusLabel: Record<string, { text: string; color: string }> = {
    FROZEN: { text: '平台托管中', color: 'text-orange-400 bg-orange-400/10' },
    DEDUCTED: { text: '历史已结算', color: 'text-blue-400 bg-blue-400/10' },
    REFUNDED: { text: '已退还', color: 'text-green-400 bg-green-400/10' },
  };

  return (
    <>
      <header className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur-lg border-b border-gray-800 px-4 py-3">
        <h1 className="text-lg font-bold">个人中心</h1>
      </header>

      {/* User card */}
      <div className="mx-4 mt-4 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-5 border border-gray-800">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-2xl font-bold text-white shrink-0">
            {user?.nickname?.charAt(0) || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate">{user?.nickname || '加载中...'}</h2>
            <div className="text-sm text-gray-400 mt-1 space-y-0.5">
              {user?.phone && <div>{user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}</div>}
              {user?.email && <div>{user.email}</div>}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              注册于 {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
            </div>
          </div>
        </div>
      </div>

      {/* Wallet balance */}
      <div className="mx-4 mt-4 bg-gradient-to-br from-amber-500/15 to-orange-600/10 rounded-2xl p-5 border border-amber-500/20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-amber-200/80 font-medium">钱包余额</div>
            <div className="text-3xl font-extrabold text-amber-300 mt-2">
              ¥{(user?.balance ?? 0).toLocaleString()}
            </div>
            <div className="text-xs text-gray-400 mt-2">用于缴纳参拍保证金，可自行设置</div>
          </div>
          <span className="text-3xl">💳</span>
        </div>
        <div className="mt-4 flex gap-2">
          <input
            type="number"
            min={0}
            step="0.01"
            value={balanceInput}
            onChange={(e) => setBalanceInput(e.target.value)}
            placeholder="设置余额"
            className="flex-1 min-w-0 rounded-xl bg-gray-950/60 border border-gray-800 px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={handleSetBalance}
            disabled={balanceLoading}
            className="px-4 py-2 rounded-xl bg-amber-500 text-gray-950 text-sm font-bold disabled:opacity-50"
          >
            {balanceLoading ? '保存中' : '保存'}
          </button>
        </div>
        {walletMsg && <div className="text-xs text-amber-200 mt-2">{walletMsg}</div>}
      </div>

      {/* Wallet */}
      <div className="mx-4 mt-4 bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-lg">💰</span>
            <span className="font-bold">平台保证金</span>
          </div>
          <button
            onClick={() => setShowDeposits(!showDeposits)}
            className="text-xs text-orange-400"
          >
            {showDeposits ? '收起' : '查看明细'}
          </button>
        </div>

        <div className="grid grid-cols-3 divide-x divide-gray-800">
          <div className="py-4 text-center">
            <div className="text-xl font-bold text-orange-400">
              ¥{frozenAmount.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-1">托管中</div>
          </div>
          <div className="py-4 text-center">
            <div className="text-xl font-bold text-blue-400">
              ¥{settledAmount.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-1">历史已结算</div>
          </div>
          <div className="py-4 text-center">
            <div className="text-xl font-bold text-green-400">
              ¥{totalRefunded.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-1">已退还</div>
          </div>
        </div>

        {/* Deposit details */}
        {showDeposits && (
          <div className="border-t border-gray-800 max-h-64 overflow-y-auto">
            {deposits.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">暂无保证金记录</div>
            ) : (
              deposits.map((d) => {
                const st = statusLabel[d.status] || statusLabel.FROZEN;
                return (
                  <div
                    key={d.id}
                    className="px-5 py-3 flex items-center justify-between border-b border-gray-800/50 last:border-0"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        {d.auction?.product?.title || `竞拍 #${d.auctionId}`}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {new Date(d.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono font-medium">
                        ¥{d.amount.toLocaleString()}
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${st.color}`}>
                        {st.text}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Menu items */}
      <div className="mx-4 mt-4 bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <button
          onClick={() => navigate('/my-bids')}
          className="w-full px-5 py-4 flex items-center justify-between border-b border-gray-800 active:bg-gray-800/50 transition"
        >
          <div className="flex items-center gap-3">
            <span>🔨</span>
            <span className="text-sm">我的竞拍</span>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
        </button>
        <button
          onClick={() => navigate('/orders')}
          className="w-full px-5 py-4 flex items-center justify-between border-b border-gray-800 active:bg-gray-800/50 transition"
        >
          <div className="flex items-center gap-3">
            <span>📋</span>
            <span className="text-sm">我的订单</span>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      {/* Actions */}
      <div className="mx-4 mt-4 mb-4 space-y-3">
        <button
          onClick={handleSwitchAccount}
          className="w-full py-3 rounded-2xl text-sm font-medium bg-gray-900 border border-gray-800 text-gray-300 active:bg-gray-800 transition"
        >
          切换账号
        </button>
        <button
          onClick={handleLogout}
          className="w-full py-3 rounded-2xl text-sm font-medium bg-gray-900 border border-red-900/30 text-red-400 active:bg-red-900/20 transition"
        >
          退出登录
        </button>
      </div>
    </>
  );
}
