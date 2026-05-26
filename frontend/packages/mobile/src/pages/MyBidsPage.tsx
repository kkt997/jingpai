import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi } from '@jingpai/shared';

interface BidRecord {
  id: number;
  auctionId: number;
  amount: number;
  bidTime: string;
  productTitle: string;
  productImage: string;
  auctionMode: 'OPEN' | 'BLIND';
  auctionStatus: string;
  isWinner: boolean;
}

const statusMap: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: '进行中', color: 'text-green-400' },
  EXTENDED: { label: '延时中', color: 'text-yellow-400' },
  COMPLETED: { label: '已成交', color: 'text-purple-400' },
  FAILED: { label: '流拍', color: 'text-gray-400' },
  CANCELLED: { label: '已取消', color: 'text-red-400' },
};

export default function MyBidsPage() {
  const [bids, setBids] = useState<BidRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    userApi.bids().then((res: any) => {
      setBids(res.data || []);
      setLoading(false);
    });
  }, []);

  // Group bids by auction
  const auctionMap = new Map<number, { bids: BidRecord[]; latest: BidRecord }>();
  for (const bid of bids) {
    const existing = auctionMap.get(bid.auctionId);
    if (existing) {
      existing.bids.push(bid);
    } else {
      auctionMap.set(bid.auctionId, { bids: [bid], latest: bid });
    }
  }

  return (
    <>
      <header className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur-lg border-b border-gray-800 px-4 py-3">
        <h1 className="text-lg font-bold">我的竞拍</h1>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">加载中...</div>
      ) : auctionMap.size === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="text-4xl mb-3">🏷️</div>
          <div>暂无竞拍记录</div>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm"
          >
            去参与竞拍
          </button>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {Array.from(auctionMap.entries()).map(([auctionId, { latest, bids: auctionBids }]) => {
            const s = statusMap[latest.auctionStatus] || statusMap.COMPLETED;
            return (
              <div
                key={auctionId}
                className="bg-gray-900 rounded-xl p-4 border border-gray-800"
              >
                <div className="flex items-start gap-3">
                  {latest.productImage ? (
                    <img src={latest.productImage} className="w-14 h-14 rounded-lg object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gray-800 flex items-center justify-center text-2xl">🎁</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{latest.productTitle || '竞拍商品'}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs ${s.color}`}>{s.label}</span>
                      <span className="text-xs text-gray-500">
                        {latest.auctionMode === 'BLIND' ? '盲拍' : '明拍'}
                      </span>
                    </div>
                  </div>
                  {latest.isWinner && (
                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full font-bold">
                      中标
                    </span>
                  )}
                </div>

                <div className="mt-3 flex justify-between items-center">
                  <div>
                    <div className="text-xs text-gray-400">我的最高出价</div>
                    <div className="text-orange-400 font-bold">¥{latest.amount.toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">出价 {auctionBids.length} 次</div>
                    <div className="text-xs text-gray-500">{latest.bidTime}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
