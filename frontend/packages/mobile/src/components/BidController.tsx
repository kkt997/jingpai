import { useState, useEffect, useCallback } from 'react';
import { WsClient, depositApi } from '@jingpai/shared';
import { useAuctionStore } from '../stores/auctionStore';
import { useBidStore } from '../stores/bidStore';

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
      <div className="sticky bottom-0 bg-gray-900 border-t border-gray-800 px-4 py-4 space-y-3">
        <div className="text-center space-y-2">
          <div className="text-amber-400 text-sm font-medium">
            本场竞拍需缴纳保证金方可出价
          </div>
          <div className="text-gray-400 text-xs">
            保证金 ¥{depositAmount.toLocaleString()} · 未中标自动退还 · 中标抵扣货款
          </div>
        </div>
        <button
          onClick={handlePayDeposit}
          disabled={depositLoading}
          className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 active:scale-[0.98] disabled:opacity-50 transition"
        >
          {depositLoading ? '处理中...' : `缴纳保证金 ¥${depositAmount.toLocaleString()}`}
        </button>
      </div>
    );
  }

  return (
    <div className="sticky bottom-0">
      {/* Toast */}
      {toast && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-30 bg-red-500/90 text-white text-xs px-4 py-1.5 rounded-full whitespace-nowrap shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {/* Collapsed bar — always visible */}
      {!expanded ? (
        <div className="bg-gray-900/95 backdrop-blur border-t border-gray-800 px-4 py-2.5 flex items-center gap-3">
          <button
            onClick={() => setExpanded(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 active:scale-[0.98] transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m-8-8h16" />
            </svg>
            我要出价
          </button>
          <div className="text-right shrink-0">
            <div className="text-[10px] text-gray-500 leading-tight">最低出价</div>
            <div className="text-sm font-bold text-orange-400 tabular-nums">¥{minBid.toLocaleString()}</div>
          </div>
        </div>
      ) : (
        /* Expanded panel */
        <div className="bg-gray-900/95 backdrop-blur border-t border-gray-800 px-4 pt-2 pb-3 space-y-2.5">
          {/* Header with collapse button */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {mode === 'BLIND' ? '盲拍模式 · 出价仅自己可见' : `最低出价 ¥${minBid.toLocaleString()}`}
            </span>
            <button
              onClick={() => setExpanded(false)}
              className="p-1 text-gray-500 hover:text-gray-300 transition"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Amount input + bid button */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">¥</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                min={minBid}
                max={ceiling ?? undefined}
                step={increment}
                className="w-full pl-8 pr-3 py-3 rounded-xl bg-gray-800 border border-gray-700 text-lg font-bold text-center focus:border-orange-500 focus:outline-none tabular-nums"
              />
            </div>
            <button
              onClick={handleBid}
              disabled={bidPending}
              className={`px-6 py-3 rounded-xl font-bold text-white transition whitespace-nowrap active:scale-95 ${
                cooldown
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-orange-500 to-red-500'
              } disabled:opacity-50`}
            >
              {bidPending ? '出价中...' : cooldown ? '冷却中' : '出价'}
            </button>
          </div>

          {/* Quick add buttons */}
          <div className="flex gap-2 justify-center">
            {[1, 5, 10].map((n) => (
              <button
                key={n}
                onClick={() => setAmount((a) => a + increment * n)}
                className="px-4 py-1.5 bg-gray-800 rounded-lg text-sm text-gray-300 active:bg-gray-700 transition"
              >
                +{(increment * n).toLocaleString()}
              </button>
            ))}
          </div>

          {depositRequired && hasDeposit && (
            <p className="text-xs text-green-500/70 text-center">保证金已缴纳 ¥{depositAmount.toLocaleString()}</p>
          )}
        </div>
      )}
    </div>
  );
}
