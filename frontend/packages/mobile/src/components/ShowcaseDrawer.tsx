import { AnimatePresence, motion } from 'framer-motion';
import { X, ShoppingBag, Eye, Coins, Check, AlertTriangle } from 'lucide-react';
import { ShowcaseItem } from '@jingpai/shared';
import { useShowcaseStore } from '../stores/showcaseStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onViewProduct: (productId: number) => void;
  onFocusBid: () => void;
}

export default function ShowcaseDrawer({ isOpen, onClose, onViewProduct, onFocusBid }: Props) {
  const { showcaseItems, loading } = useShowcaseStore();

  const handleItemClick = (item: ShowcaseItem) => {
    // 点击查看商品细节
    onViewProduct(item.product.id);
  };

  const handleActionClick = (e: React.MouseEvent, item: ShowcaseItem) => {
    e.stopPropagation(); // 阻止触发详情弹窗
    if (item.status === 'ACTIVE' || item.status === 'EXTENDED') {
      onFocusBid();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />

          {/* Bottom Sheet Drawer */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto z-50 rounded-t-3xl border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-xl shadow-2xl p-6 pb-8 text-zinc-100 flex flex-col space-y-5"
          >
            {/* Drawer Header Drag Handle Bar */}
            <div className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-1 shrink-0" />

            {/* Header Content */}
            <div className="flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-brand/10 text-brand rounded-xl border border-brand/20">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="font-bold text-base text-zinc-100">直播拍品柜</h3>
                  <p className="text-[10px] text-zinc-500 font-semibold uppercase">本场拍品清单 · 实时状态更新</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body Area */}
            {loading ? (
              <div className="py-24 text-center text-sm font-semibold text-zinc-500 animate-pulse">
                正在同步拍品清单...
              </div>
            ) : showcaseItems.length > 0 ? (
              <div className="flex-1 overflow-y-auto space-y-4 pr-0.5 max-h-[60vh] scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                {showcaseItems.map((item) => {
                  const isActive = item.status === 'ACTIVE' || item.status === 'EXTENDED';
                  const isCompleted = item.status === 'COMPLETED';
                  const isFailed = item.status === 'FAILED' || item.status === 'CANCELLED';
                  const isPending = item.status === 'PENDING' || item.status === 'DRAFT';

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`relative flex gap-3.5 p-3.5 rounded-2xl border transition duration-200 cursor-pointer ${
                        isActive
                          ? 'bg-brand/5 border-brand/40 shadow-lg shadow-brand/5 ring-1 ring-brand/20 animate-pulse-subtle'
                          : isCompleted
                          ? 'bg-zinc-950/20 border-zinc-900/80 opacity-70 hover:opacity-90'
                          : isFailed
                          ? 'bg-zinc-950/10 border-zinc-900/50 opacity-55'
                          : 'bg-zinc-900/30 border-zinc-800/80 hover:border-zinc-700/80'
                      }`}
                    >
                      {/* Sequence Badge */}
                      <span className="absolute top-3 left-3 flex items-center justify-center w-5 h-5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[10px] font-bold text-zinc-400 tabular-nums">
                        {String(item.sequence).padStart(2, '0')}
                      </span>

                      {/* Image Thumbnail */}
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800/60 shrink-0 select-none">
                        {item.product.images && item.product.images.length > 0 ? (
                          <img
                            src={item.product.images[0]}
                            alt={item.product.title}
                            className={`w-full h-full object-cover transition duration-300 ${
                              isCompleted || isFailed ? 'filter grayscale brightness-75' : ''
                            }`}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-700">
                            <ShoppingBag className="w-6 h-6" />
                          </div>
                        )}
                      </div>

                      {/* Info Panel */}
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div className="space-y-1">
                          <h4 className="font-bold text-sm text-zinc-200 truncate leading-snug tracking-tight">
                            {item.product.title}
                          </h4>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* Status tags */}
                            {isActive && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[9px] font-bold border border-emerald-500/20 animate-pulse">
                                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping" />
                                竞拍中
                              </span>
                            )}
                            {isCompleted && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[9px] font-bold border border-amber-500/15">
                                <Check className="w-2.5 h-2.5" />
                                已成交
                              </span>
                            )}
                            {isFailed && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 text-[9px] font-bold border border-zinc-700/30">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                已流拍
                              </span>
                            )}
                            {isPending && (
                              <span className="px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 text-[9px] font-bold border border-zinc-700/40">
                                待开拍
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Price Details */}
                        <div className="flex items-end justify-between mt-1">
                          <div>
                            {isActive && (
                              <div className="space-y-0.5">
                                <span className="text-[10px] text-zinc-500 font-semibold">当前价</span>
                                <div className="text-sm font-extrabold text-amber-400 tabular-nums">
                                  ¥{item.currentPrice?.toLocaleString()}
                                </div>
                              </div>
                            )}
                            {isCompleted && (
                              <div className="space-y-0.5">
                                <span className="text-[10px] text-zinc-400 font-semibold">成交价</span>
                                <div className="text-sm font-bold text-zinc-300 tabular-nums">
                                  ¥{item.finalPrice?.toLocaleString()}
                                </div>
                                {item.winnerNickname && (
                                  <div className="text-[9px] text-zinc-500 font-medium truncate max-w-[120px]">
                                    得主: {item.winnerNickname}
                                  </div>
                                )}
                              </div>
                            )}
                            {isFailed && (
                              <div className="space-y-0.5">
                                <span className="text-[10px] text-zinc-600 font-semibold">起拍价</span>
                                <div className="text-xs font-semibold text-zinc-500 line-through tabular-nums">
                                  ¥{item.startingPrice?.toLocaleString()}
                                </div>
                              </div>
                            )}
                            {isPending && (
                              <div className="space-y-0.5">
                                <span className="text-[10px] text-zinc-500 font-semibold">起拍价</span>
                                <div className="text-sm font-bold text-zinc-300 tabular-nums">
                                  ¥{item.startingPrice?.toLocaleString()}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Quick CTA Actions */}
                          {isActive && (
                            <button
                              onClick={(e) => handleActionClick(e, item)}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white bg-gradient-to-r from-brand to-orange-500 hover:shadow-md hover:shadow-brand/20 transition-all duration-150 flex items-center gap-1 active:scale-95"
                            >
                              <Coins className="w-3 h-3" />
                              <span>立即出价</span>
                            </button>
                          )}
                          {isPending && (
                            <div className="text-[10px] font-semibold text-zinc-500 flex items-center gap-1 bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-800/80">
                              <Eye className="w-3 h-3 text-zinc-600" />
                              <span>详情</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-24 text-center text-sm font-semibold text-zinc-500">
                暂无拍品柜清单数据
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
