import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { WsClient } from '@jingpai/shared';
import { useAuthStore } from '../stores/authStore';
import { useAuctionStore } from '../stores/auctionStore';
import { useBidStore } from '../stores/bidStore';
import { useRoomStore } from '../stores/roomStore';
import { createWsDispatcher } from '../ws/dispatcher';
import LiveStreamPlayer from '../components/LiveStreamPlayer';
import CountdownTimer from '../components/CountdownTimer';
import RankingList from '../components/RankingList';
import BidController from '../components/BidController';
import NotificationLayer from '../components/NotificationLayer';

export default function AuctionRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const token = useAuthStore((s) => s.token);
  const wsRef = useRef<WsClient | null>(null);

  const auction = useAuctionStore();
  const bid = useBidStore();
  const room = useRoomStore();

  useEffect(() => {
    if (!token || !roomId) return;

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
    const ws = new WsClient(wsUrl, token);
    wsRef.current = ws;

    room.setRoom(Number(roomId));
    const cleanup = createWsDispatcher(ws, Number(roomId));
    ws.connect();

    return () => {
      cleanup();
      ws.disconnect();
      auction.reset();
      bid.reset();
      room.reset();
    };
  }, [token, roomId]);

  const isActive = auction.status === 'ACTIVE' || auction.status === 'EXTENDED';
  const isEnded = auction.status === 'COMPLETED' || auction.status === 'FAILED' || auction.status === 'CANCELLED';

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Live stream */}
      <LiveStreamPlayer
        streamUrl={room.streamUrl}
        roomTitle={`直播间 #${roomId}`}
        onlineCount={room.onlineCount}
        connectionStatus={room.connectionStatus}
      />

      {/* Auction info */}
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="font-bold text-lg">{auction.product?.title || '等待竞拍开始...'}</h2>
        <div className="flex items-center gap-2 mt-1">
          {auction.mode === 'BLIND' && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-400">
              盲拍模式
            </span>
          )}
          {isActive && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">
              竞拍中
            </span>
          )}
          {isEnded && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-gray-500/20 text-gray-400">
              已结束
            </span>
          )}
        </div>
      </div>

      {/* Price + Countdown */}
      <div className="px-4 py-4 text-center border-b border-gray-800">
        {auction.mode === 'BLIND' && isActive ? (
          <div>
            <div className="text-gray-400 text-sm">盲拍进行中</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">
              已有 {auction.bidCount} 人出价
            </div>
          </div>
        ) : (
          <div>
            <div className="text-gray-400 text-sm">
              {isEnded ? '成交价' : '当前最高价'}
            </div>
            <div className="text-3xl font-bold text-orange-400 mt-1 tabular-nums">
              ¥{auction.currentPrice.toLocaleString()}
            </div>
          </div>
        )}
        {isActive && <CountdownTimer endTime={auction.endTime} />}
        {auction.extendCount > 0 && isActive && (
          <div className="text-xs text-yellow-500 mt-1">
            已延时 {auction.extendCount}/{auction.maxExtendCount} 次
          </div>
        )}
      </div>

      {/* Ranking */}
      <div className="flex-1 overflow-auto px-4 py-3">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-bold text-gray-400">实时排行榜</h3>
          {bid.myRank && (
            <span className="text-xs text-orange-400">我的排名: 第{bid.myRank}名</span>
          )}
        </div>
        <RankingList ranking={bid.ranking} />
      </div>

      {/* Bid controller (fixed bottom) */}
      {isActive && wsRef.current && (
        <BidController ws={wsRef.current} />
      )}

      <NotificationLayer />
    </div>
  );
}
