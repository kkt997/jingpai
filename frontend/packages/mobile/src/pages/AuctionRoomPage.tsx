import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { WsClient, conversationApi } from '@jingpai/shared';
import { useAuthStore } from '../stores/authStore';
import { useAuctionStore } from '../stores/auctionStore';
import { useBidStore } from '../stores/bidStore';
import { useRoomStore } from '../stores/roomStore';
import { useChatStore } from '../stores/chatStore';
import { useShowcaseStore } from '../stores/showcaseStore';
import { createWsDispatcher } from '../ws/dispatcher';
import LiveStreamPlayer from '../components/LiveStreamPlayer';
import CountdownTimer from '../components/CountdownTimer';
import BidController from '../components/BidController';
import NotificationLayer from '../components/NotificationLayer';
import ProductDetailDrawer from '../components/ProductDetailDrawer';
import ShowcaseDrawer from '../components/ShowcaseDrawer';
import { Eye, Send, Trophy, Clock, Sparkles, WalletCards, Gavel, MessageCircleMore } from 'lucide-react';

export default function AuctionRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const wsRef = useRef<WsClient | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [showShowcase, setShowShowcase] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | undefined>(undefined);
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
      chatStore.clearMessages();
      auction.reset();
      bid.reset();
      room.reset();
      showcase.reset();
      setDepositDrawerOpen(false);
      setBidPanelExpanded(false);
    };
  }, [token, roomId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatStore.messages]);

  const isActive = auction.status === 'ACTIVE' || auction.status === 'EXTENDED';
  const isEnded = auction.status === 'COMPLETED' || auction.status === 'FAILED' || auction.status === 'CANCELLED';
  const hasAuction = !!auction.auction?.id;
  const increment = auction.auction?.incrementAmount ?? 100;

  const productImage = (() => {
    const imgs = auction.product?.images;
    if (!imgs) return null;
    if (Array.isArray(imgs)) return imgs[0] || null;
    if (typeof imgs === 'string') {
      try { const p = JSON.parse(imgs); return Array.isArray(p) ? p[0] : null; } catch { return null; }
    }
    return null;
  })();

  const handleQuickBid = (multiplier: number) => {
    const auctionId = auction.auction?.id;
    if (!wsRef.current || !auctionId || bid.bidPending) return;
    if (auction.depositRequired && !auction.hasDeposit) {
      setDepositDrawerOpen(true);
      return;
    }
    const amount = auction.currentPrice + increment * multiplier;
    bid.placeBid(wsRef.current, auctionId, amount);
  };

  const merchantUserId = auction.product?.merchantId || auction.auction?.merchantId || undefined;

  const handleOpenMerchant = () => {
    if (!merchantUserId) return;
    navigate(`/merchants/${merchantUserId}`);
  };

  const handleContactMerchant = async () => {
    if (!merchantUserId) return;
    try {
      const res: any = await conversationApi.create(merchantUserId);
      navigate(`/messages/${res.data.id}`);
    } catch (err: any) {
      alert(err?.msg || '联系商家失败');
    }
  };

  return (
    <div className="h-[100dvh] relative overflow-hidden bg-black select-none antialiased text-white">
      {/* ═══ Full-screen video background ═══ */}
      <div className="absolute inset-0 z-0">
        <LiveStreamPlayer streamUrl={room.streamUrl} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80 pointer-events-none" />
      </div>

      {/* ═══ Floating UI layer ═══ */}
      <div className="absolute inset-0 z-20 flex flex-col justify-between p-3 pointer-events-none">

        {/* ─── Top bar ─── */}
        <div className="flex items-start justify-between pointer-events-auto pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              aria-label="返回"
              onClick={() => navigate(-1)}
              className="w-8 h-8 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 active:bg-black/60"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <div className="flex items-center bg-black/40 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse mr-1.5" />
              <span className="text-xs font-bold mr-2">LIVE</span>
              <span className="text-xs text-gray-300">直播间 #{roomId}</span>
            </div>
            {merchantUserId && (
              <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-full px-2 py-1 border border-white/10">
                <button
                  type="button"
                  onClick={handleOpenMerchant}
                  className="px-2.5 py-1 rounded-full text-xs text-white hover:bg-white/10 transition"
                >
                  商家主页
                </button>
                <button
                  type="button"
                  onClick={handleContactMerchant}
                  className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-300 hover:bg-orange-500/30 transition"
                  title="联系商家"
                >
                  <MessageCircleMore className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <div className="bg-black/40 backdrop-blur-md rounded-full px-3 py-1 text-xs flex items-center border border-white/10">
                <Eye className="w-3 h-3 mr-1.5 opacity-70" />
                {room.onlineCount} 人
              </div>
            </div>

            {/* Mini leaderboard */}
            {bid.ranking.length > 0 && (
              <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-2 w-40 shadow-xl">
                <div className="text-[10px] text-amber-400 font-bold mb-1.5 flex items-center justify-between px-0.5">
                  <span><Trophy className="w-3 h-3 inline mr-1" />竞拍榜</span>
                  <span className="text-gray-400 font-normal">实时</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {bid.ranking.slice(0, 3).map((item, i) => {
                    const medals = ['🥇', '🥈', '🥉'];
                    return (
                      <button
                        type="button"
                        key={`${item.rank}-${item.alias}`}
                        disabled={!item.isMe}
                        className={`flex items-center justify-between p-1 rounded-lg border w-full text-left transition ${
                          item.isMe
                            ? 'bg-brand/20 border-brand/50 cursor-default'
                            : 'bg-white/5 border-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <span className="text-[10px] w-3 text-center">{medals[i]}</span>
                          <span className={`text-[10px] truncate max-w-[3.5rem] ${item.isMe ? 'text-brand font-bold' : 'text-gray-300'}`}>
                            {item.isMe ? '我' : item.alias}
                          </span>
                        </div>
                        <span className={`text-[10px] font-mono font-bold ${item.isMe ? 'text-amber-300' : 'text-gray-200'}`}>
                          {item.amount !== null ? `¥${item.amount.toLocaleString()}` : '¥•••'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Connection status */}
            {room.connectionStatus !== 'connected' && (
              <div className="bg-yellow-500/90 px-3 py-1 rounded-full text-xs text-black font-medium">
                {room.connectionStatus === 'reconnecting' ? '重连中…' : '连接断开'}
              </div>
            )}
          </div>
        </div>

        {/* ─── Bottom section ─── */}
        <div className="flex flex-col gap-2.5 pointer-events-auto">

          {/* Chat messages (left 75%, floating style) */}
          <div className="h-36 w-3/4 overflow-y-auto no-scrollbar mask-top flex flex-col">
            <div className="mt-auto space-y-1.5">
              {chatStore.messages.map((msg) => {
                const isSystem = msg.type === 'system' || msg.nickname === '系统';
                return (
                  <div
                    key={msg.id}
                    className={`chat-slide-in text-[13px] w-max max-w-full rounded-xl px-3 py-1.5 backdrop-blur-sm break-words ${
                      isSystem
                        ? 'bg-black/40 border border-brand/30'
                        : msg.isMe
                          ? 'bg-black/30 border border-blue-400/20'
                          : 'bg-black/20 border border-white/5'
                    }`}
                  >
                    {isSystem ? (
                      <>
                        <span className="text-brand font-semibold">{msg.nickname}: </span>
                        <span className="text-rose-100">{msg.message}</span>
                      </>
                    ) : (
                      <>
                        <span className={`font-medium ${msg.isMe ? 'text-blue-300' : 'text-gray-300'}`}>{msg.nickname}: </span>
                        <span className="text-white">{msg.message}</span>
                      </>
                    )}
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Auction card */}
          {hasAuction && (
            <div className="bg-black/50 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-3 relative overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)]">
              <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 via-transparent to-brand/10 pointer-events-none" />

              {isActive && (
                <div className="absolute -top-0 -left-0 bg-gradient-to-r from-brand to-red-500 text-white text-[10px] px-2 py-0.5 rounded-br-lg font-bold z-10">
                  <span className="w-1.5 h-1.5 bg-white rounded-full inline-block animate-pulse mr-0.5 align-middle" />
                  {' '}正在竞拍
                </div>
              )}

              <div className="flex gap-3 relative z-10">
                <button
                  type="button"
                  onClick={() => auction.product?.id && setSelectedProductId(auction.product.id)}
                  className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-white/20 active:opacity-80"
                >
                  {productImage ? (
                    <img className="w-full h-full object-cover" src={productImage} alt="" />
                  ) : (
                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                      <Gavel className="w-6 h-6 text-zinc-600" />
                    </div>
                  )}
                </button>

                <div className="flex-1 flex flex-col justify-between pt-0.5 min-w-0">
                  <div>
                    <h3 className="font-bold text-sm text-white line-clamp-1">
                      {auction.product?.title || '竞拍商品'}
                    </h3>
                    <div className="text-xs text-amber-200/80 mt-0.5">
                      起拍: ¥{(auction.auction?.startingPrice ?? 0).toLocaleString()} | 加价: ¥{increment.toLocaleString()}
                    </div>
                  </div>

                  <div className="flex justify-between items-end mt-1">
                    <div className="flex flex-col min-w-0">
                      {auction.mode === 'BLIND' && isActive ? (
                        <span className="text-[10px] text-gray-300">
                          🔒 已有 <span className="text-amber-400 font-bold">{auction.bidCount}</span> 人出价
                        </span>
                      ) : (
                        <>
                          <span className="text-[10px] text-gray-300 -mb-0.5 truncate">
                            当前最高{' '}
                            <span className="text-amber-400 font-bold">
                              {bid.ranking[0] ? `(@${bid.ranking[0].alias})` : '(@等待出价)'}
                            </span>
                          </span>
                          <div className="text-brand font-extrabold text-2xl tracking-tighter flex items-baseline drop-shadow-md">
                            <span className="text-sm mr-0.5">¥</span>
                            <span>{auction.currentPrice.toLocaleString()}</span>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="shrink-0">
                      {isActive ? (
                        <CountdownTimer endTime={auction.endTime} compact />
                      ) : isEnded ? (
                        <span className="text-xs text-zinc-400 bg-zinc-800/60 px-2 py-1 rounded-md font-mono">已落锤</span>
                      ) : (
                        <span className="text-xs text-amber-400 bg-brand/20 border border-brand/50 px-2 py-1 rounded-md font-mono font-bold">
                          <Clock className="w-3 h-3 inline mr-0.5" />等待
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {auction.extendCount > 0 && isActive && (
                <div className="mt-2 text-center text-[10px] text-amber-400/80 relative z-10">
                  延时 {auction.extendCount}/{auction.maxExtendCount} 次
                </div>
              )}
            </div>
          )}

          {/* ─── Persistent bid bar — always visible during active auction ─── */}
          {isActive && (
            <div className="bg-black/60 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-2.5 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickBid(1)}
                  disabled={bid.bidPending}
                  className="bg-gradient-to-b from-white/10 to-white/5 hover:from-white/20 active:scale-95 text-white rounded-xl py-2.5 text-sm font-bold border border-white/10 transition-all disabled:opacity-40"
                >
                  +{increment.toLocaleString()}
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickBid(5)}
                  disabled={bid.bidPending}
                  className="bg-gradient-to-b from-white/10 to-white/5 hover:from-amber-500/20 active:scale-95 text-amber-400 rounded-xl py-2.5 text-sm font-bold border border-amber-500/30 transition-all disabled:opacity-40"
                >
                  +{(increment * 5).toLocaleString()}
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickBid(10)}
                  disabled={bid.bidPending}
                  className="bg-gradient-to-b from-orange-500/20 to-orange-500/5 hover:from-orange-500/40 active:scale-95 text-orange-400 rounded-xl py-2.5 text-sm font-bold border border-orange-500/50 transition-all shadow-[0_0_10px_rgba(249,115,22,0.2)] disabled:opacity-40"
                >
                  +{(increment * 10).toLocaleString()}
                </button>
                <button
                  type="button"
                  onClick={() => setBidPanelExpanded(true)}
                  className="bg-gradient-to-r from-brand to-orange-500 hover:from-brand-dark text-white rounded-xl py-2.5 text-sm font-bold active:scale-95 transition-all shadow-lg"
                >
                  出价
                </button>
              </div>
            </div>
          )}

          {/* Bottom bar: chat input + action buttons */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat(); }}
                maxLength={100}
                placeholder="凑个热闹..."
                className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-full py-2.5 px-4 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-brand/50 transition"
              />
              <button
                type="button"
                onClick={handleSendChat}
                disabled={!chatInput.trim()}
                title="发送消息"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-brand disabled:opacity-30"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {auction.depositRequired && !auction.hasDeposit && !isEnded && (
              <button
                type="button"
                onClick={() => setDepositDrawerOpen(true)}
                className="w-10 h-10 shrink-0 rounded-full bg-amber-500/20 backdrop-blur-md border border-amber-500/30 flex items-center justify-center active:scale-90 transition-transform"
                title="参拍保证金"
              >
                <WalletCards className="w-4 h-4 text-amber-400" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowShowcase(true)}
              className="w-10 h-10 shrink-0 rounded-full bg-purple-500/20 backdrop-blur-md border border-purple-500/30 flex items-center justify-center active:scale-90 transition-transform"
              title="拍品柜"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Overlays ═══ */}
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
          setBidPanelExpanded(true);
        }}
      />
    </div>
  );
}
