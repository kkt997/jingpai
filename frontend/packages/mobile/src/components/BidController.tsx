import { useState, useEffect } from 'react';
import { WsClient, depositApi } from '@jingpai/shared';
import { useAuctionStore } from '../stores/auctionStore';
import { useBidStore } from '../stores/bidStore';
import { ShieldAlert, ShieldCheck, TrendingUp, EyeOff, Coins } from 'lucide-react';

interface Props {
  ws: WsClient;
}

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

  useEffect(() => {
    setAmount(minBid);
  }, [minBid]);

  const handleBid = () => {
    if (!auctionId || bidPending) return;
    placeBid(ws, auctionId, amount);
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
    <div className="sticky bottom-0 bg-zinc-950/95 border-t border-zinc-900 backdrop-blur-lg px-4 py-4 space-y-4 shadow-2xl">
      {lastBidResult && !lastBidResult.accepted && (
        <div className="text-red-400 text-xs font-semibold text-center mt-1 animate-pulse">{lastBidResult.msg}</div>
      )}

      {/* Input & Bid Action */}
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
          className="px-8 py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-brand to-orange-500 hover:shadow-lg hover:shadow-brand/20 active:scale-95 disabled:opacity-40 transition-all duration-200 text-sm flex items-center gap-1.5"
        >
          <Coins className="w-4 h-4" />
          <span>{bidPending ? '...' : '出价'}</span>
        </button>
      </div>

      {/* Quick Add buttons */}
      <div className="flex gap-2 justify-center">
        {[1, 5, 10].map((n) => (
          <button
            key={n}
            onClick={() => setAmount((a: number) => a + increment * n)}
            className="px-4 py-2 bg-zinc-900/60 border border-zinc-800/60 rounded-xl text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50 active:scale-95 transition-all duration-150"
          >
            +{(increment * n).toLocaleString()}
          </button>
        ))}
      </div>

      {/* Auxiliary Notice */}
      <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-zinc-600">
        {depositRequired && hasDeposit && (
          <div className="flex items-center gap-1 text-emerald-500/90 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">
            <ShieldCheck className="w-3 h-3" />
            <span>已缴保证金 ¥{depositAmount.toLocaleString()}</span>
          </div>
        )}
        {!depositRequired && (
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>最低出价 ¥{minBid.toLocaleString()}</span>
          </div>
        )}
        {mode === 'BLIND' && (
          <div className="flex items-center gap-1 text-purple-400 bg-purple-500/5 px-2 py-0.5 rounded border border-purple-500/10">
            <EyeOff className="w-3 h-3" />
            <span>盲拍 · 金额仅自己可见</span>
          </div>
        )}
      </div>
    </div>
  );
}
