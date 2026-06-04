import { useState, useEffect, useCallback } from 'react';
import { WsClient, depositApi } from '@jingpai/shared';
import { useAuctionStore } from '../stores/auctionStore';
import { useBidStore } from '../stores/bidStore';
import { ShieldAlert, ShieldCheck, Coins } from 'lucide-react';

interface Props {
  ws: WsClient;
}

const COOLDOWN_MS = 1500;

export default function BidController({ ws }: Props) {
  const currentPrice = useAuctionStore((s) => s.currentPrice);
  const increment = useAuctionStore((s) => s.auction?.incrementAmount ?? 100);
  const ceiling = useAuctionStore((s) => s.auction?.ceilingPrice);
  const auctionId = useAuctionStore((s) => s.auction?.id);
  const mode = useAuctionStore((s) => s.mode);
  const depositRequired = useAuctionStore((s) => s.depositRequired);
  const depositAmount = useAuctionStore((s) => s.depositAmount);
  const hasDeposit = useAuctionStore((s) => s.hasDeposit);
  const setDepositPaid = useAuctionStore((s) => s.setDepositPaid);
  const { placeBid, bidPending, lastBidResult } = useBidStore();

  const minBid = currentPrice + increment;
  const [amount, setAmount] = useState(minBid);
  const [depositLoading, setDepositLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    setAmount(minBid);
  }, [minBid]);

  useEffect(() => {
    if (lastBidResult && !lastBidResult.accepted) {
      showToast(lastBidResult.msg || '出价失败');
    }
  }, [lastBidResult]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }, []);

  const handleBid = () => {
    if (!auctionId || bidPending) return;
    if (cooldown) {
      showToast('出价太频繁了，请稍后再试');
      return;
    }
    if (amount < minBid) {
      showToast(`最低出价 ¥${minBid.toLocaleString()}`);
      return;
    }
    if (ceiling && amount > ceiling) {
      showToast(`不能超过封顶价 ¥${ceiling.toLocaleString()}`);
      return;
    }
    placeBid(ws, auctionId, amount);
    setCooldown(true);
    setTimeout(() => setCooldown(false), COOLDOWN_MS);
  };

  const handlePayDeposit = async () => {
    if (!auctionId || depositLoading) return;
    setDepositLoading(true);
    try {
      await depositApi.pay(auctionId);
      setDepositPaid();
    } catch (err: any) {
      alert(err?.msg || '缴纳保证金失败');
    } finally {
      setDepositLoading(false);
    }
  };

  if (depositRequired && !hasDeposit) {
    return (
      <div className="sticky bottom-0 bg-zinc-950/95 border-t border-zinc-900 backdrop-blur-lg px-4 py-5 space-y-4 shadow-2xl">
        <div className="text-center space-y-1.5">
          <div className="text-amber-400 text-sm font-semibold flex items-center justify-center gap-1.5">
            <ShieldAlert className="w-4 h-4 animate-bounce" />
            <span>本场竞拍需缴纳保证金方可出价</span>
          </div>
          <div className="text-zinc-500 text-xs font-medium">
            保证金 ¥{depositAmount.toLocaleString()} · 未中标自动退还 · 中标抵扣货款
          </div>
        </div>
        <button
          onClick={handlePayDeposit}
          disabled={depositLoading}
          className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:shadow-lg hover:shadow-amber-500/10 active:scale-[0.98] disabled:opacity-50 transition-all duration-200 text-sm"
        >
          {depositLoading ? '正在处理中...' : `缴纳保证金 ¥${depositAmount.toLocaleString()}`}
        </button>
      </div>
    );
  }

  return (
    <div className="sticky bottom-0 z-30">
      {/* Toast */}
      {toast && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-40 bg-red-500/90 text-white text-xs px-4 py-1.5 rounded-full whitespace-nowrap shadow-lg animate-pulse">
          {toast}
        </div>
      )}

      {/* Collapsed bar — always visible */}
      {!expanded ? (
        <div className="bg-zinc-950/95 backdrop-blur-lg border-t border-zinc-900 px-4 py-3 flex items-center gap-3 shadow-2xl">
          <button
            onClick={() => setExpanded(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-brand to-orange-500 hover:shadow-lg hover:shadow-brand/20 active:scale-[0.98] transition-all duration-200 text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m-8-8h16" />
            </svg>
            <span>我要出价</span>
          </button>
          <div className="text-right shrink-0">
            <div className="text-[10px] text-zinc-500 leading-tight">最低出价</div>
            <div className="text-sm font-bold text-amber-400 tabular-nums">¥{minBid.toLocaleString()}</div>
          </div>
        </div>
      ) : (
        /* Expanded panel */
        <div className="bg-zinc-950/95 backdrop-blur-lg border-t border-zinc-900 px-4 pt-3.5 pb-4 space-y-3.5 shadow-2xl">
          {/* Header with collapse button */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 font-medium">
              {mode === 'BLIND' ? '🔒 盲拍模式 · 出价金额仅自己可见' : `📈 最低出价 ¥${minBid.toLocaleString()}`}
            </span>
            <button
              onClick={() => setExpanded(false)}
              className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60 rounded-lg transition"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Amount input + bid button */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative rounded-xl bg-zinc-900/60 border border-zinc-800/80 focus-within:border-brand/80 focus-within:ring-1 focus-within:ring-brand/30 transition duration-200">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-base">¥</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                min={minBid}
                max={ceiling ?? undefined}
                step={increment}
                className="w-full pl-8 pr-3 py-3 bg-transparent text-zinc-100 text-lg font-bold text-center focus:outline-none tabular-nums"
              />
            </div>
            <button
              onClick={handleBid}
              disabled={bidPending || amount < minBid}
              className={`px-6 py-3.5 rounded-xl font-bold text-white transition-all duration-200 whitespace-nowrap active:scale-95 text-sm flex items-center gap-1 ${
                cooldown
                  ? 'bg-zinc-700 text-zinc-400 border border-zinc-600/40 cursor-not-allowed'
                  : 'bg-gradient-to-r from-brand to-orange-500 hover:shadow-lg hover:shadow-brand/20'
              } disabled:opacity-50`}
            >
              <Coins className="w-4 h-4" />
              <span>{bidPending ? '...' : cooldown ? '冷却中' : '出价'}</span>
            </button>
          </div>

          {/* Quick add buttons */}
          <div className="flex gap-2 justify-center">
            {[1, 5, 10].map((n) => (
              <button
                key={n}
                onClick={() => setAmount((a) => a + increment * n)}
                className="px-4 py-2 bg-zinc-900/60 border border-zinc-800/60 rounded-xl text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50 active:scale-95 transition-all duration-150"
              >
                +{(increment * n).toLocaleString()}
              </button>
            ))}
          </div>

          {depositRequired && hasDeposit && (
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-emerald-500/90 bg-emerald-500/5 px-2.5 py-1 rounded-lg border border-emerald-500/10 max-w-xs mx-auto">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>已缴保证金 ¥{depositAmount.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
