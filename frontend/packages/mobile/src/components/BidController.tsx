import { useState, useEffect } from 'react';
import { WsClient } from '@jingpai/shared';
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
  const { placeBid, bidPending, lastBidResult } = useBidStore();

  const minBid = currentPrice + increment;
  const [amount, setAmount] = useState(minBid);

  useEffect(() => {
    setAmount(minBid);
  }, [minBid]);

  const handleBid = () => {
    if (!auctionId || bidPending) return;
    placeBid(ws, auctionId, amount);
  };

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

      {mode === 'BLIND' ? (
        <p className="text-xs text-gray-600 text-center">盲拍模式 · 出价金额仅自己可见</p>
      ) : (
        <p className="text-xs text-gray-600 text-center">最低出价 ¥{minBid.toLocaleString()}</p>
      )}
    </div>
  );
}
