import { useState, useEffect } from 'react';
import { WsClient, depositApi } from '@jingpai/shared';
import { useAuctionStore } from '../stores/auctionStore';
import { useBidStore } from '../stores/bidStore';

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
    <div className="sticky bottom-0 bg-gray-900 border-t border-gray-800 px-4 py-3 space-y-3">
      {lastBidResult && !lastBidResult.accepted && (
        <div className="text-red-400 text-xs text-center">{lastBidResult.msg}</div>
      )}

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
          disabled={bidPending || amount < minBid}
          className="px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 active:scale-95 disabled:opacity-50 transition whitespace-nowrap"
        >
          {bidPending ? '...' : '出价'}
        </button>
      </div>

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
      {mode === 'BLIND' ? (
        <p className="text-xs text-gray-600 text-center">盲拍模式 · 出价金额仅自己可见</p>
      ) : (
        <p className="text-xs text-gray-600 text-center">最低出价 ¥{minBid.toLocaleString()}</p>
      )}
    </div>
  );
}
