import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { WsClient, depositApi } from '@jingpai/shared';
import { useAuctionStore } from '../stores/auctionStore';
import { useBidStore } from '../stores/bidStore';
import { ShieldAlert, ShieldCheck, Coins, X } from 'lucide-react';

interface Props {
  ws: WsClient;
  depositDrawerOpen?: boolean;
  bidPanelExpanded?: boolean;
  onDepositDrawerChange?: (open: boolean) => void;
  onBidPanelExpandedChange?: (expanded: boolean) => void;
}

const COOLDOWN_MS = 1500;

export default function BidController({
  ws,
  depositDrawerOpen,
  bidPanelExpanded,
  onDepositDrawerChange,
  onBidPanelExpandedChange,
}: Props) {
  const currentPrice = useAuctionStore((s) => s.currentPrice);
  const increment = useAuctionStore((s) => s.auction?.incrementAmount ?? 100);
  const ceiling = useAuctionStore((s) => s.auction?.ceilingPrice);
  const auctionId = useAuctionStore((s) => s.auction?.id);
  const mode = useAuctionStore((s) => s.mode);
  const depositRequired = useAuctionStore((s) => s.depositRequired);
  const depositAmount = useAuctionStore((s) => s.depositAmount);
  const hasDeposit = useAuctionStore((s) => s.hasDeposit);
  const canRefund = useAuctionStore((s) => s.canRefund);
  const refundHint = useAuctionStore((s) => s.refundHint);
  const setDepositPaid = useAuctionStore((s) => s.setDepositPaid);
  const setDepositRefunded = useAuctionStore((s) => s.setDepositRefunded);
  const { placeBid, bidPending, lastBidResult } = useBidStore();

  const minBid = currentPrice + increment;
  const [amount, setAmount] = useState(minBid);
  const [depositLoading, setDepositLoading] = useState(false);
  const [refundLoading, setRefundLoading] = useState(false);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [toast, setToast] = useState('');
  const [internalDrawerOpen, setInternalDrawerOpen] = useState(false);

  const expanded = bidPanelExpanded ?? internalExpanded;
  const drawerOpen = depositDrawerOpen ?? internalDrawerOpen;

  const setExpanded = (next: boolean) => {
    onBidPanelExpandedChange?.(next);
    if (bidPanelExpanded === undefined) {
      setInternalExpanded(next);
    }
  };

  const setDrawerOpen = (next: boolean) => {
    onDepositDrawerChange?.(next);
    if (depositDrawerOpen === undefined) {
      setInternalDrawerOpen(next);
    }
  };

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
    if (depositRequired && !hasDeposit) {
      setDrawerOpen(true);
      showToast('请先参加竞拍并缴纳平台保证金');
      return;
    }
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
      setDrawerOpen(false);
      showToast('已参加竞拍，平台保证金托管中');
    } catch (err: any) {
      showToast(err?.msg || '缴纳保证金失败');
    } finally {
      setDepositLoading(false);
    }
  };

  const handleRefundDeposit = async () => {
    if (!auctionId || refundLoading) return;
    setRefundLoading(true);
    try {
      await depositApi.refund(auctionId);
      setDepositRefunded();
      setDrawerOpen(false);
      showToast('保证金已退回平台钱包');
    } catch (err: any) {
      showToast(err?.msg || '申请退款失败');
    } finally {
      setRefundLoading(false);
    }
  };

  return (
    <>
      <div className="sticky bottom-0 z-30">
        {toast && (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-40 bg-red-500/90 text-white text-xs px-4 py-1.5 rounded-full whitespace-nowrap shadow-lg animate-pulse">
            {toast}
          </div>
        )}

        {!expanded ? (
          <div className="bg-zinc-950/95 backdrop-blur-lg border-t border-zinc-900 px-4 py-3 flex items-center gap-3 shadow-2xl">
            <button
              type="button"
              title={depositRequired && !hasDeposit ? '展开参拍后出价面板' : '展开出价面板'}
              onClick={() => setExpanded(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-brand to-orange-500 hover:shadow-lg hover:shadow-brand/20 active:scale-[0.98] transition-all duration-200 text-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m-8-8h16" />
              </svg>
              <span>{depositRequired && !hasDeposit ? '参加后可出价' : '我要出价'}</span>
            </button>
            <div className="text-right shrink-0">
              <div className="text-[10px] text-zinc-500 leading-tight">最低出价</div>
              <div className="text-sm font-bold text-amber-400 tabular-nums">¥{minBid.toLocaleString()}</div>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-950/95 backdrop-blur-lg border-t border-zinc-900 px-4 pt-3.5 pb-4 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500 font-medium">
                {mode === 'BLIND' ? '🔒 盲拍模式 · 出价金额仅自己可见' : `📈 最低出价 ¥${minBid.toLocaleString()}`}
              </span>
              <button
                type="button"
                aria-label="收起出价面板"
                title="收起"
                onClick={() => setExpanded(false)}
                className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60 rounded-lg transition"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 relative rounded-xl bg-zinc-900/60 border border-zinc-800/80 focus-within:border-brand/80 focus-within:ring-1 focus-within:ring-brand/30 transition duration-200">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-base">¥</span>
                <input
                  aria-label="出价金额"
                  placeholder="请输入出价金额"
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
                type="button"
                title={depositRequired && !hasDeposit ? '先参加竞拍' : '提交出价'}
                onClick={handleBid}
                disabled={bidPending || amount < minBid}
                className={`px-6 py-3.5 rounded-xl font-bold text-white transition-all duration-200 whitespace-nowrap active:scale-95 text-sm flex items-center gap-1 ${
                  cooldown
                    ? 'bg-zinc-700 text-zinc-400 border border-zinc-600/40 cursor-not-allowed'
                    : depositRequired && !hasDeposit
                      ? 'bg-zinc-700 text-zinc-300 border border-zinc-600/40'
                      : 'bg-gradient-to-r from-brand to-orange-500 hover:shadow-lg hover:shadow-brand/20'
                } disabled:opacity-50`}
              >
                <Coins className="w-4 h-4" />
                <span>
                  {bidPending ? '...' : cooldown ? '冷却中' : depositRequired && !hasDeposit ? '先参拍' : '出价'}
                </span>
              </button>
            </div>

            <div className="flex gap-2 justify-center">
              {[1, 5, 10].map((n) => (
                <button
                  type="button"
                  title={`快捷加价 ${(increment * n).toLocaleString()} 元`}
                  key={n}
                  onClick={() => setAmount((a) => a + increment * n)}
                  className="px-4 py-2 bg-zinc-900/60 border border-zinc-800/60 rounded-xl text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50 active:scale-95 transition-all duration-150"
                >
                  +{(increment * n).toLocaleString()}
                </button>
              ))}
            </div>

            {depositRequired && (
              <div className={`flex items-center justify-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border max-w-xs mx-auto ${
                hasDeposit
                  ? 'text-emerald-500/90 bg-emerald-500/5 border-emerald-500/10'
                  : 'text-amber-400 bg-amber-500/5 border-amber-500/10'
              }`}>
                {hasDeposit ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                <span>
                  {hasDeposit
                    ? `平台托管中 ¥${depositAmount.toLocaleString()}`
                    : `需先缴纳平台保证金 ¥${depositAmount.toLocaleString()}`}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              transition={{ type: 'spring', damping: 24, stiffness: 260 }}
              className="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 rounded-3xl border border-zinc-800 bg-zinc-950/96 backdrop-blur-xl shadow-2xl p-5 text-zinc-100 flex flex-col gap-4 max-w-sm mx-auto"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold">参拍保证金</div>
                  <div className="text-[11px] text-zinc-500 mt-1">平台统一托管，不归商家管理</div>
                </div>
                <button
                  type="button"
                  aria-label="关闭参拍保证金面板"
                  title="关闭"
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-2">
                <div className="text-xs text-zinc-500">当前场次保证金</div>
                <div className="text-2xl font-extrabold text-amber-400 tabular-nums">¥{depositAmount.toLocaleString()}</div>
                <div className="text-xs text-zinc-400 leading-relaxed">
                  {refundHint || '参加竞拍后方可出价；直播结束后平台自动退回保证金。'}
                </div>
              </div>

              {!hasDeposit ? (
                <button
                  type="button"
                  title="支付保证金并参加竞拍"
                  onClick={handlePayDeposit}
                  disabled={depositLoading}
                  className="w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 disabled:opacity-50"
                >
                  {depositLoading ? '正在处理...' : '支付保证金并参加竞拍'}
                </button>
              ) : (
                <>
                  <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-4 text-sm text-emerald-300 font-semibold flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    已参加竞拍，保证金平台托管中
                  </div>
                  <button
                    type="button"
                    title="申请退还保证金"
                    onClick={handleRefundDeposit}
                    disabled={!canRefund || refundLoading}
                    className="w-full py-3.5 rounded-2xl font-bold text-white bg-zinc-800 border border-zinc-700 disabled:opacity-40"
                  >
                    {refundLoading ? '正在申请...' : '申请退还保证金'}
                  </button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
