import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  MSG_RANKING_UPDATE,
  conversationApi,
} from '@jingpai/shared';

interface BidRecord {
  id: string;
  alias: string;
  amount: number;
  time: number;
  isExtend?: boolean;
}

interface RankingEntry {
  rank: number;
  alias: string;
  amount: number | null;
  userId: number;
}

interface AuctionState {
  id: number;
  status: string;
  mode: string;
  currentPrice: number;
  bidCount: number;
  endTime: number;
  extendCount: number;
  productTitle: string;
  winnerAlias: string;
  finalPrice: number;
}

const STATUS_MAP: Record<string, { label: string; dot: string }> = {
  ACTIVE: { label: '竞拍中', dot: 'bg-green-500' },
  EXTENDED: { label: '延时中', dot: 'bg-yellow-500' },
  COMPLETED: { label: '已成交', dot: 'bg-blue-500' },
  FAILED: { label: '已流拍', dot: 'bg-gray-400' },
  CANCELLED: { label: '已取消', dot: 'bg-red-500' },
  PENDING: { label: '待开始', dot: 'bg-orange-400' },
};

export default function LivePanelPage() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [connStatus, setConnStatus] = useState<ConnectionStatus>('disconnected');
  const [onlineCount, setOnlineCount] = useState(0);
  const [auction, setAuction] = useState<AuctionState | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [bidFeed, setBidFeed] = useState<BidRecord[]>([]);
  const [remaining, setRemaining] = useState(0);

  const wsRef = useRef<WsClient | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    roomApi.merchantList().then((res: any) => {
      const all: LiveRoom[] = res.data || [];
      setRooms(all);
      const live = all.find((r) => r.status === 'LIVE');
      if (live && !selectedRoomId) setSelectedRoomId(live.id);
    });
  }, []);

  const connectToRoom = useCallback((roomId: number) => {
    cleanupRef.current?.();
    wsRef.current?.disconnect();

    setAuction(null);
    setRanking([]);
    setBidFeed([]);
    setOnlineCount(0);

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
          ws.send({ type: MSG_JOIN_ROOM, payload: { roomId } });
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
            extendCount: d.auction.extendCount || 0,
            productTitle: d.auction.productTitle || '',
            winnerAlias: '',
            finalPrice: 0,
          });
          if (d.auction.ranking) {
            setRanking(
              (d.auction.ranking as any[]).map((r: any, i: number) => ({
                rank: i + 1,
                alias: r.alias || r.nickname || `用户${r.userId}`,
                amount: r.amount ?? null,
                userId: r.userId,
              }))
            );
          }
        }
      })
    );

    unsubs.push(
      ws.on(MSG_NEW_BID, (msg) => {
        const d = msg.data as any;
        setAuction((prev) =>
          prev
            ? {
                ...prev,
                currentPrice: d.currentPrice ?? prev.currentPrice,
                bidCount: d.bidCount ?? prev.bidCount,
              }
            : prev
        );
        setBidFeed((prev) => {
          const entry: BidRecord = {
            id: `${Date.now()}-${Math.random()}`,
            alias: d.alias || d.bidderAlias || '匿名',
            amount: d.amount || d.bidAmount || 0,
            time: d.time || msg.ts,
          };
          return [entry, ...prev].slice(0, 50);
        });
        if (d.ranking) {
          setRanking(
            (d.ranking as any[]).map((r: any, i: number) => ({
              rank: i + 1,
              alias: r.alias || r.nickname || `用户${r.userId}`,
              amount: r.amount ?? null,
              userId: r.userId,
            }))
          );
        }
      })
    );

    unsubs.push(
      ws.on(MSG_RANKING_UPDATE, (msg) => {
        const d = msg.data as any;
        if (d.ranking) {
          setRanking(
            (d.ranking as any[]).map((r: any, i: number) => ({
              rank: i + 1,
              alias: r.alias || r.nickname || `用户${r.userId}`,
              amount: r.amount ?? null,
              userId: r.userId,
            }))
          );
        }
      })
    );

    unsubs.push(
      ws.on(MSG_AUCTION_START, (msg) => {
        const d = msg.data as any;
        setAuction({
          id: d.auctionId || d.id,
          status: 'ACTIVE',
          mode: d.mode || 'OPEN',
          currentPrice: d.startingPrice || 0,
          bidCount: 0,
          endTime: d.endTime || 0,
          extendCount: 0,
          productTitle: d.productTitle || '',
          winnerAlias: '',
          finalPrice: 0,
        });
        setRanking([]);
        setBidFeed([]);
      })
    );

    unsubs.push(
      ws.on(MSG_AUCTION_EXTEND, (msg) => {
        const d = msg.data as any;
        setAuction((prev) =>
          prev
            ? {
                ...prev,
                status: 'EXTENDED',
                endTime: d.newEndTime || d.endTime || prev.endTime,
                extendCount: d.extendCount ?? (prev.extendCount + 1),
              }
            : prev
        );
        setBidFeed((prev) => [
          {
            id: `ext-${Date.now()}`,
            alias: '系统',
            amount: 0,
            time: msg.ts,
            isExtend: true,
          },
          ...prev,
        ]);
      })
    );

    unsubs.push(
      ws.on(MSG_AUCTION_END, (msg) => {
        const d = msg.data as any;
        setAuction((prev) =>
          prev
            ? {
                ...prev,
                status: d.result === 'completed' ? 'COMPLETED' : d.result === 'failed' ? 'FAILED' : 'CANCELLED',
                winnerAlias: d.winnerAlias || '',
                finalPrice: d.finalPrice || prev.currentPrice,
              }
            : prev
        );
      })
    );

    unsubs.push(
      ws.on(MSG_COUNTDOWN_SYNC, (msg) => {
        const d = msg.data as any;
        setAuction((prev) =>
          prev ? { ...prev, endTime: d.endTime || prev.endTime } : prev
        );
      })
    );

    unsubs.push(
      ws.on(MSG_USER_COUNT, (msg) => {
        const d = msg.data as any;
        setOnlineCount(d.count || 0);
      })
    );

    cleanupRef.current = () => unsubs.forEach((u) => u());
    ws.connect();
  }, []);

  useEffect(() => {
    if (selectedRoomId) connectToRoom(selectedRoomId);
    return () => {
      cleanupRef.current?.();
      wsRef.current?.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [selectedRoomId, connectToRoom]);

  useEffect(() => {
    const tick = () => {
      if (auction?.endTime) {
        setRemaining(timeSync.remaining(auction.endTime));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [auction?.endTime]);

  const formatTime = (ms: number) => {
    if (ms <= 0) return '00:00';
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const isLive = auction?.status === 'ACTIVE' || auction?.status === 'EXTENDED';
  const statusInfo = STATUS_MAP[auction?.status || ''] || { label: '无竞拍', dot: 'bg-gray-300' };

  const handleContactUser = async (userId: number) => {
    try {
      const res: any = await conversationApi.create(userId);
      navigate(`/messages/${res.data.id}`);
    } catch (err: any) {
      alert(err?.msg || '发起私聊失败');
    }
  };

  return (
    <div className="p-6 h-[calc(100vh-0px)] flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">实时竞拍面板</h2>
        <div className="flex items-center gap-3">
          <select
            value={selectedRoomId ?? ''}
            onChange={(e) => setSelectedRoomId(e.target.value ? Number(e.target.value) : null)}
            className="border rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">选择直播间</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title} #{r.id} {r.status === 'LIVE' ? '(直播中)' : ''}
              </option>
            ))}
          </select>
          <StatusDot status={connStatus} />
        </div>
      </div>

      {!selectedRoomId ? (
        <div className="flex-1 flex items-center justify-center bg-white rounded-xl border">
          <div className="text-center text-gray-400">
            <div className="text-5xl mb-4">📡</div>
            <div className="text-lg">选择一个直播间以开始监控</div>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
          {/* Left: Auction status + countdown */}
          <div className="col-span-4 flex flex-col gap-4">
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-700 text-sm">竞拍状态</h3>
                <span className="flex items-center gap-1.5 text-xs">
                  <span className={`w-2 h-2 rounded-full ${statusInfo.dot}`} />
                  {statusInfo.label}
                </span>
              </div>
              {auction ? (
                <div className="space-y-3">
                  {auction.productTitle && (
                    <div className="text-xs text-gray-500 truncate">{auction.productTitle}</div>
                  )}
                  <div className="text-xs text-gray-400">
                    模式：{auction.mode === 'BLIND' ? '盲拍' : '明拍'}
                  </div>
                  <div className="text-center py-3">
                    <div className="text-xs text-gray-400 mb-1">当前最高价</div>
                    <div className="text-3xl font-bold text-gray-900">
                      ¥{auction.currentPrice.toLocaleString()}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-lg font-bold text-blue-600">{auction.bidCount}</div>
                      <div className="text-xs text-gray-400">出价次数</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-lg font-bold text-purple-600">{auction.extendCount}</div>
                      <div className="text-xs text-gray-400">延时次数</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm">暂无竞拍</div>
              )}
            </div>

            {/* Countdown */}
            {isLive && (
              <div
                className={`rounded-xl border p-5 text-center ${
                  remaining < 10_000
                    ? 'bg-red-50 border-red-200'
                    : remaining < 30_000
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-white'
                }`}
              >
                <div className="text-xs text-gray-400 mb-2">剩余时间</div>
                <div
                  className={`text-4xl font-mono font-bold ${
                    remaining < 10_000 ? 'text-red-600 animate-pulse' : 'text-gray-900'
                  }`}
                >
                  {formatTime(remaining)}
                </div>
                {auction?.status === 'EXTENDED' && (
                  <div className="text-xs text-yellow-600 mt-2">
                    已延时 {auction.extendCount} 次
                  </div>
                )}
              </div>
            )}

            {/* Result summary */}
            {(auction?.status === 'COMPLETED' || auction?.status === 'FAILED') && (
              <div
                className={`rounded-xl border p-5 ${
                  auction.status === 'COMPLETED'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50'
                }`}
              >
                <div className="text-center">
                  {auction.status === 'COMPLETED' ? (
                    <>
                      <div className="text-sm text-green-600 font-medium mb-1">竞拍成交</div>
                      <div className="text-2xl font-bold text-green-700">
                        ¥{auction.finalPrice.toLocaleString()}
                      </div>
                      {auction.winnerAlias && (
                        <div className="text-xs text-gray-500 mt-1">
                          中标者：{auction.winnerAlias}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-gray-500">竞拍流拍，无人出价</div>
                  )}
                </div>
              </div>
            )}

            {/* Online count */}
            <div className="bg-white rounded-xl border p-4 flex items-center justify-between">
              <span className="text-sm text-gray-500">在线观众</span>
              <span className="text-lg font-bold text-gray-800">{onlineCount}</span>
            </div>
          </div>

          {/* Middle: Ranking */}
          <div className="col-span-4 bg-white rounded-xl border flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50">
              <h3 className="font-bold text-gray-700 text-sm">出价排行榜</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {ranking.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">暂无出价</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b">
                      <th className="text-left px-4 py-2 w-12">#</th>
                      <th className="text-left px-4 py-2">竞拍者</th>
                      <th className="text-right px-4 py-2">出价</th>
                      <th className="text-left px-4 py-2 w-28">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((r) => (
                      <tr
                        key={r.rank}
                        className={`border-b last:border-0 ${
                          r.rank === 1 ? 'bg-yellow-50' : ''
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          {r.rank <= 3 ? (
                            <span className="text-lg">
                              {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : '🥉'}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">{r.rank}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-700">
                          {r.alias}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-right font-mono">
                          {r.amount !== null ? (
                            <span className="text-gray-900 font-medium">
                              ¥{r.amount.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-gray-300">****</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() => handleContactUser(r.userId)}
                            className="px-3 py-1 rounded-lg border border-zinc-200 text-zinc-700 text-xs hover:bg-zinc-50"
                          >
                            私信
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right: Bid feed */}
          <div className="col-span-4 bg-white rounded-xl border flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-700 text-sm">实时出价动态</h3>
              {bidFeed.length > 0 && (
                <span className="text-xs text-gray-400">{bidFeed.length} 条记录</span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {bidFeed.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">等待出价...</div>
              ) : (
                <div className="divide-y">
                  {bidFeed.map((b) => (
                    <div
                      key={b.id}
                      className={`px-4 py-3 ${b.isExtend ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}
                    >
                      {b.isExtend ? (
                        <div className="text-xs text-yellow-600 font-medium text-center">
                          -- 竞拍延时 --
                        </div>
                      ) : (
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-sm font-medium text-gray-700">{b.alias}</span>
                            <span className="text-xs text-gray-400 ml-2">
                              {new Date(b.time).toLocaleTimeString()}
                            </span>
                          </div>
                          <span className="text-sm font-mono font-bold text-blue-600">
                            ¥{b.amount.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: ConnectionStatus }) {
  const config: Record<ConnectionStatus, { color: string; label: string }> = {
    connected: { color: 'bg-green-500', label: '已连接' },
    connecting: { color: 'bg-yellow-500 animate-pulse', label: '连接中' },
    reconnecting: { color: 'bg-yellow-500 animate-pulse', label: '重连中' },
    disconnected: { color: 'bg-gray-400', label: '未连接' },
  };
  const c = config[status];
  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className={`w-2 h-2 rounded-full ${c.color}`} />
      {c.label}
    </span>
  );
}
