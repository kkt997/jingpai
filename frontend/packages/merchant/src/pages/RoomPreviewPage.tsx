import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  WsClient,
  ConnectionStatus,
  roomApi,
  LiveRoom,
  timeSync,
  MSG_JOIN_ROOM,
  MSG_ROOM_STATE,
  MSG_NEW_BID,
  MSG_AUCTION_START,
  MSG_AUCTION_EXTEND,
  MSG_AUCTION_END,
  MSG_COUNTDOWN_SYNC,
  MSG_USER_COUNT,
} from '@jingpai/shared';

interface BidRecord {
  id: string;
  alias: string;
  amount: number;
  time: number;
}

interface AuctionInfo {
  id: number;
  status: string;
  mode: string;
  currentPrice: number;
  bidCount: number;
  endTime: number;
  productTitle: string;
}

const DEMO_VIDEO = 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4';

export default function RoomPreviewPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<LiveRoom | null>(null);
  const [connStatus, setConnStatus] = useState<ConnectionStatus>('disconnected');
  const [onlineCount, setOnlineCount] = useState(0);
  const [auction, setAuction] = useState<AuctionInfo | null>(null);
  const [bidFeed, setBidFeed] = useState<BidRecord[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [videoError, setVideoError] = useState(false);

  const wsRef = useRef<WsClient | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!roomId) return;
    roomApi.get(Number(roomId)).then((res: any) => setRoom(res.data));
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    const token = localStorage.getItem('token') || '';
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}/ws`;
    const ws = new WsClient(wsUrl, token);
    wsRef.current = ws;

    const unsubs: (() => void)[] = [];

    unsubs.push(
      ws.onStatus((status) => {
        setConnStatus(status);
        if (status === 'connected') {
          ws.send({ type: MSG_JOIN_ROOM, payload: { roomId: Number(roomId) } });
        }
      })
    );

    unsubs.push(
      ws.on(MSG_ROOM_STATE, (msg) => {
        const d = msg.data as any;
        setOnlineCount(d.onlineCount || 0);
        if (d.auction && d.auction.status && d.auction.status !== 'DRAFT') {
          setAuction({
            id: d.auction.id,
            status: d.auction.status,
            mode: d.auction.mode || 'OPEN',
            currentPrice: d.auction.currentPrice || 0,
            bidCount: d.auction.bidCount || 0,
            endTime: d.auction.endTime || 0,
            productTitle: d.auction.productTitle || '',
          });
        }
      })
    );

    unsubs.push(
      ws.on(MSG_NEW_BID, (msg) => {
        const d = msg.data as any;
        setAuction((prev) =>
          prev ? { ...prev, currentPrice: d.currentPrice ?? prev.currentPrice, bidCount: d.bidCount ?? prev.bidCount } : prev
        );
        setBidFeed((prev) =>
          [{ id: `${Date.now()}-${Math.random()}`, alias: d.alias || d.bidderAlias || '匿名', amount: d.amount || d.bidAmount || 0, time: msg.ts }, ...prev].slice(0, 30)
        );
      })
    );

    unsubs.push(ws.on(MSG_AUCTION_START, (msg) => {
      const d = msg.data as any;
      setAuction({ id: d.auctionId || d.id, status: 'ACTIVE', mode: d.mode || 'OPEN', currentPrice: d.startingPrice || 0, bidCount: 0, endTime: d.endTime || 0, productTitle: d.productTitle || '' });
      setBidFeed([]);
    }));

    unsubs.push(ws.on(MSG_AUCTION_EXTEND, (msg) => {
      const d = msg.data as any;
      setAuction((prev) => prev ? { ...prev, status: 'EXTENDED', endTime: d.newEndTime || d.endTime || prev.endTime } : prev);
    }));

    unsubs.push(ws.on(MSG_AUCTION_END, (msg) => {
      const d = msg.data as any;
      setAuction((prev) => prev ? { ...prev, status: d.result === 'completed' ? 'COMPLETED' : d.result === 'failed' ? 'FAILED' : 'CANCELLED' } : prev);
    }));

    unsubs.push(ws.on(MSG_COUNTDOWN_SYNC, (msg) => {
      const d = msg.data as any;
      setAuction((prev) => prev ? { ...prev, endTime: d.endTime || prev.endTime } : prev);
    }));

    unsubs.push(ws.on(MSG_USER_COUNT, (msg) => {
      const d = msg.data as any;
      setOnlineCount(d.count || 0);
    }));

    cleanupRef.current = () => unsubs.forEach((u) => u());
    ws.connect();

    return () => {
      cleanupRef.current?.();
      wsRef.current?.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [roomId]);

  useEffect(() => {
    const tick = () => {
      if (auction?.endTime) setRemaining(timeSync.remaining(auction.endTime));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [auction?.endTime]);

  const formatTime = (ms: number) => {
    if (ms <= 0) return '00:00';
    const s = Math.ceil(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  const isLive = auction?.status === 'ACTIVE' || auction?.status === 'EXTENDED';
  const videoSrc = room?.streamUrl || DEMO_VIDEO;

  const connLabel: Record<string, string> = {
    connected: '已连接',
    connecting: '连接中...',
    reconnecting: '重连中...',
    disconnected: '未连接',
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/rooms')}
          className="text-gray-400 hover:text-gray-600 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h2 className="text-2xl font-bold text-gray-800">
          {room?.title || '直播间'} <span className="text-base font-normal text-gray-400">#{roomId}</span>
        </h2>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${connStatus === 'connected' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
          {connLabel[connStatus] || connStatus}
        </span>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left: Video + auction info */}
        <div className="col-span-7 space-y-4">
          {/* Video player */}
          <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
            {!videoError ? (
              <video
                src={videoSrc}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
                onError={() => setVideoError(true)}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center">
                <div className="text-4xl mb-2 opacity-40">📡</div>
                <div className="text-sm text-gray-400">直播画面</div>
              </div>
            )}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              {room?.status === 'LIVE' && (
                <div className="bg-red-600 px-2 py-0.5 rounded text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  LIVE
                </div>
              )}
            </div>
            <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-white">
              {onlineCount} 人观看
            </div>
          </div>

          {/* Auction status */}
          <div className="bg-white rounded-xl border p-5">
            {auction ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-800">{auction.productTitle || '竞拍商品'}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    isLive ? 'bg-green-100 text-green-600' : auction.status === 'COMPLETED' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {isLive ? '竞拍中' : auction.status === 'COMPLETED' ? '已成交' : auction.status === 'FAILED' ? '已流拍' : auction.status === 'PENDING' ? '待开始' : '已结束'}
                  </span>
                </div>
                <div className="flex items-center gap-8">
                  <div>
                    <div className="text-xs text-gray-400">当前最高价</div>
                    <div className="text-2xl font-bold text-orange-600">¥{auction.currentPrice.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">出价次数</div>
                    <div className="text-2xl font-bold text-gray-800">{auction.bidCount}</div>
                  </div>
                  {isLive && (
                    <div>
                      <div className="text-xs text-gray-400">剩余时间</div>
                      <div className={`text-2xl font-bold font-mono ${remaining < 10000 ? 'text-red-600 animate-pulse' : 'text-gray-800'}`}>
                        {formatTime(remaining)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-400">暂无竞拍</div>
            )}
          </div>
        </div>

        {/* Right: Live bid feed */}
        <div className="col-span-5 bg-white rounded-xl border flex flex-col overflow-hidden" style={{ maxHeight: 'calc(56.25vw * 7/12 + 180px)' }}>
          <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
            <h3 className="font-bold text-gray-700 text-sm">出价动态</h3>
            <span className="text-xs text-gray-400">{bidFeed.length} 条</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {bidFeed.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">等待出价...</div>
            ) : (
              <div className="divide-y">
                {bidFeed.map((b) => (
                  <div key={b.id} className="px-4 py-3 hover:bg-gray-50">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm font-medium text-gray-700">{b.alias}</span>
                        <span className="text-xs text-gray-400 ml-2">{new Date(b.time).toLocaleTimeString()}</span>
                      </div>
                      <span className="text-sm font-mono font-bold text-blue-600">¥{b.amount.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
