import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { WsClient } from '@jingpai/shared';
import { useAuthStore } from '../stores/authStore';
import { useAuctionStore } from '../stores/auctionStore';
import { useBidStore } from '../stores/bidStore';
import { useRoomStore } from '../stores/roomStore';
import { useChatStore } from '../stores/chatStore';
import { useShowcaseStore } from '../stores/showcaseStore';
import { createWsDispatcher } from '../ws/dispatcher';
import LiveStreamPlayer from '../components/LiveStreamPlayer';
import CountdownTimer from '../components/CountdownTimer';
import RankingList from '../components/RankingList';
import ChatList from '../components/ChatList';
import BidController from '../components/BidController';
import NotificationLayer from '../components/NotificationLayer';
import ProductDetailDrawer from '../components/ProductDetailDrawer';
import ShowcaseDrawer from '../components/ShowcaseDrawer';
import { History, Sparkles, ShoppingBag, Send, MessageSquare, Trophy, Flame, WalletCards, Gavel } from 'lucide-react';

export default function AuctionRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const wsRef = useRef<WsClient | null>(null);
  const [showShowcase, setShowShowcase] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'chat' | 'rank'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [depositDrawerOpen, setDepositDrawerOpen] = useState(false);
  const [bidPanelExpanded, setBidPanelExpanded] = useState(false);

  const auction = useAuctionStore();
  const bid = useBidStore();
  const room = useRoomStore();
  const chatStore = useChatStore();
  const showcase = useShowcaseStore();

  const handleSendChat = () => {
    if (!chatInput.trim() || !wsRef.current) return;
    const myAlias = bid.ranking.find((r) => r.isMe)?.alias || user?.nickname || '我';
    chatStore.sendChatMessage(wsRef.current, chatInput, myAlias);
    setChatInput('');
  };

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
      showcase.reset();
      setDepositDrawerOpen(false);
      setBidPanelExpanded(false);
    };
  }, [token, roomId]);

  const isActive = auction.status === 'ACTIVE' || auction.status === 'EXTENDED';
  const isEnded = auction.status === 'COMPLETED' || auction.status === 'FAILED' || auction.status === 'CANCELLED';
  const showVideoActions = !!wsRef.current && (auction.depositRequired || auction.status === 'PENDING' || isActive);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col select-none antialiased">
      {/* Live stream */}
      <div className="relative">
        <LiveStreamPlayer
          streamUrl={room.streamUrl}
          roomTitle={`直播间 #${roomId}`}
          onlineCount={room.onlineCount}
          connectionStatus={room.connectionStatus}
        />
        <button
          type="button"
          aria-label="返回上一页"
          title="返回"
          onClick={() => navigate(-1)}
          className="absolute top-3 left-3 z-20 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center active:bg-black/70 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {showVideoActions && (
          <>
            <button
              type="button"
              onClick={() => setDepositDrawerOpen(true)}
              className={`absolute left-3 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1 rounded-2xl border px-2.5 py-3 shadow-xl backdrop-blur-md transition ${
                auction.hasDeposit
                  ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200'
                  : 'border-amber-500/30 bg-black/55 text-amber-200'
              }`}
            >
              <WalletCards className="w-4 h-4" />
              <span className="text-[10px] font-bold leading-tight text-center whitespace-pre-line">
                {auction.hasDeposit ? '已参拍' : '参加\n竞拍'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setBidPanelExpanded(true)}
              className={`absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1 rounded-2xl border px-2.5 py-3 shadow-xl backdrop-blur-md transition ${
                isActive
                  ? 'border-brand/30 bg-black/55 text-brand'
                  : 'border-zinc-700/60 bg-black/45 text-zinc-300'
              }`}
            >
              <Gavel className="w-4 h-4" />
              <span className="text-[10px] font-bold leading-tight text-center whitespace-pre-line">
                {isActive ? (auction.depositRequired && !auction.hasDeposit ? '先参拍' : '我要\n出价') : '等待\n开拍'}
              </span>
            </button>
          </>
        )}
      </div>

      {/* Auction Info & Title */}
      <div className="px-4 py-4 border-b border-zinc-900 bg-zinc-900/20">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1.5">
            <h2 className="font-bold text-base tracking-tight text-zinc-100 leading-snug">
              {auction.product?.title || '等待竞拍开始...'}
            </h2>
            {auction.product && (
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  title="查看商品详情"
                  onClick={() => setSelectedProductId(auction.product?.id)}
                  className="inline-flex items-center gap-1.5 text-xs text-brand hover:text-brand-dark transition font-semibold"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>查看商品详情 &gt;</span>
                </button>
                <span className="w-px h-3 bg-zinc-800" />
                <button
                  type="button"
                  title="打开本场拍品柜"
                  onClick={() => setShowShowcase(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-500 transition font-semibold"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>本场拍品柜 &gt;</span>
                </button>
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-1.5">
            {auction.mode === 'BLIND' && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                盲拍
              </span>
            )}
            {isActive && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">
                竞拍中
              </span>
            )}
            {isEnded && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700/40">
                已结束
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Price & Countdown Glass Card */}
      <div className="px-4 py-4">
        <div className="backdrop-blur-md bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 shadow-lg shadow-black/20 text-center flex flex-col items-center justify-center space-y-4">
          {auction.mode === 'BLIND' && isActive ? (
            <div>
              <div className="text-zinc-500 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>盲拍进行中</span>
              </div>
              <div className="text-2xl font-bold tracking-tight text-amber-400 mt-1">
                已有 {auction.bidCount} 人出价
              </div>
            </div>
          ) : (
            <div>
              <div className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                {isEnded ? '本场成交价' : '当前最高出价'}
              </div>
              <div className="text-3xl font-extrabold tracking-tight mt-1.5 tabular-nums bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent drop-shadow-sm">
                ¥{auction.currentPrice.toLocaleString()}
              </div>
            </div>
          )}

          {isActive && <CountdownTimer endTime={auction.endTime} />}

          {auction.extendCount > 0 && isActive && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400/90 font-medium bg-amber-500/5 px-2.5 py-1 rounded-lg border border-amber-500/10">
              <History className="w-3.5 h-3.5" />
              <span>已延时 {auction.extendCount}/{auction.maxExtendCount} 次</span>
            </div>
          )}
        </div>
      </div>

      {/* 实时动态常驻横幅 (Ticker Banner) */}
      {isActive && (
        <div className="mx-4 mb-2">
          <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-brand/10 via-orange-500/5 to-transparent border border-brand/10 rounded-xl">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300 truncate">
              <Flame className="w-3.5 h-3.5 text-brand animate-pulse shrink-0" />
              {bid.ranking.length > 0 ? (
                auction.mode === 'BLIND' ? (
                  <span>🔒 盲拍激烈竞争中，已有 {auction.bidCount} 人出价！</span>
                ) : (
                  <span className="truncate">
                    🏆 领先者：<span className="text-brand font-bold">{bid.ranking[0].alias}</span> 暂以 <span className="text-amber-400 tabular-nums">¥{bid.ranking[0].amount?.toLocaleString()}</span> 领先！
                  </span>
                )
              ) : (
                <span>🔨 竞拍进行中，首位出价虚位以待！</span>
              )}
            </div>
            {bid.myRank && (
              <span className="shrink-0 ml-2 text-[10px] font-bold text-brand bg-brand/5 px-2 py-0.5 rounded-md border border-brand/15">
                第 {bid.myRank} 名
              </span>
            )}
          </div>
        </div>
      )}

      {/* 页签选择栏 (Tab Navigation) */}
      <div className="flex px-4 border-b border-zinc-900/60 bg-zinc-950/20 shrink-0">
        <button
          type="button"
          title="切换到互动聊天"
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition duration-200 ${
            activeTab === 'chat'
              ? 'border-brand text-brand'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>互动聊天 ({chatStore.messages.length})</span>
        </button>
        <button
          type="button"
          title="切换到竞拍排行"
          onClick={() => setActiveTab('rank')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition duration-200 ${
            activeTab === 'rank'
              ? 'border-brand text-brand'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>竞拍排行 ({bid.ranking.length})</span>
        </button>
      </div>

      {/* 滑动内容区 (Main Content) */}
      <div className="flex-1 overflow-hidden px-4 py-2 flex flex-col min-h-[220px]">
        {activeTab === 'chat' ? (
          <ChatList messages={chatStore.messages} />
        ) : (
          <div className="flex-1 overflow-y-auto py-1">
            <RankingList ranking={bid.ranking} />
          </div>
        )}
      </div>

      {/* 弹幕输入发送条 (常驻或浮动在出价底栏之上) */}
      {activeTab === 'chat' && (
        <div className={`px-4 py-2.5 bg-zinc-950/90 border-t border-zinc-900 flex items-center gap-2 shrink-0 ${!isActive ? 'pb-6' : ''}`}>
          <input
            type="text"
            placeholder="聊点什么吧，理性发言..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendChat();
            }}
            maxLength={100}
            className="flex-1 px-4 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition duration-200"
          />
          <button
            type="button"
            title="发送聊天消息"
            onClick={handleSendChat}
            disabled={!chatInput.trim()}
            className="p-2 rounded-xl bg-brand/10 hover:bg-brand/20 disabled:opacity-40 text-brand transition duration-150 flex items-center justify-center shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bid controller (fixed bottom) */}
      {wsRef.current && (
        <BidController
          ws={wsRef.current}
          depositDrawerOpen={depositDrawerOpen}
          bidPanelExpanded={bidPanelExpanded}
          onDepositDrawerChange={setDepositDrawerOpen}
          onBidPanelExpandedChange={setBidPanelExpanded}
        />
      )}

      <NotificationLayer />

      <ProductDetailDrawer
        isOpen={selectedProductId !== undefined}
        onClose={() => setSelectedProductId(undefined)}
        productId={selectedProductId}
        fallbackProduct={selectedProductId === auction.product?.id ? auction.product : null}
      />

      <ShowcaseDrawer
        isOpen={showShowcase}
        onClose={() => setShowShowcase(false)}
        onViewProduct={(productId) => {
          setShowShowcase(false);
          setSelectedProductId(productId);
        }}
        onFocusBid={() => {
          setActiveTab('rank');
          setBidPanelExpanded(true);
        }}
      />
    </div>
  );
}
