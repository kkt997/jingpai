import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, ShoppingBag, Info } from 'lucide-react';
import { productApi, Product } from '@jingpai/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  productId?: number;
  fallbackProduct?: Product | null;
}

export default function ProductDetailDrawer({ isOpen, onClose, productId, fallbackProduct }: Props) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    if (!isOpen || !productId) return;

    // Reset carousel index and local state
    setActiveImageIndex(0);
    setLoading(true);

    productApi
      .get(productId)
      .then((res: any) => {
        if (res.code === 0 && res.data) {
          setProduct(res.data);
        } else {
          throw new Error('API failed');
        }
      })
      .catch(() => {
        // Fallback to room product if backend API is not implemented yet
        if (fallbackProduct) {
          setProduct(fallbackProduct);
        } else {
          setProduct(null);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, productId, fallbackProduct]);

  // Handle Carousel navigation
  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product || product.images.length <= 1) return;
    setActiveImageIndex((prev) => (prev === 0 ? product.images.length - 1 : prev - 1));
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product || product.images.length <= 1) return;
    setActiveImageIndex((prev) => (prev === product.images.length - 1 ? 0 : prev + 1));
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
                <h3 className="font-bold text-base text-zinc-100">商品详情</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body Scrollable Area */}
            {loading ? (
              <div className="py-24 text-center text-sm font-semibold text-zinc-500 animate-pulse">
                正在加载商品详情...
              </div>
            ) : product ? (
              <div className="flex-1 overflow-y-auto space-y-5 pr-0.5">
                {/* Images Carousel */}
                <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800/80 group">
                  {product.images && product.images.length > 0 ? (
                    <>
                      <img
                        src={product.images[activeImageIndex]}
                        alt={product.title}
                        className="w-full h-full object-cover transition-all duration-300"
                      />

                      {/* Carousel controls */}
                      {product.images.length > 1 && (
                        <>
                          <button
                            onClick={prevImage}
                            className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 border border-white/10 text-white/80 hover:text-white transition duration-200"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={nextImage}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 border border-white/10 text-white/80 hover:text-white transition duration-200"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>

                          {/* Dots indicator */}
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/5">
                            {product.images.map((_, idx) => (
                              <span
                                key={idx}
                                className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                                  idx === activeImageIndex ? 'bg-brand scale-125' : 'bg-white/40'
                                }`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600">
                      <ShoppingBag className="w-12 h-12 mb-2 text-zinc-700" />
                      <span className="text-xs font-semibold">暂无实物大图</span>
                    </div>
                  )}

                  {/* Category Tag */}
                  {product.category && (
                    <span className="absolute top-3 right-3 px-2 py-0.5 rounded bg-brand/90 backdrop-blur text-[10px] font-bold text-white uppercase tracking-wider">
                      {product.category}
                    </span>
                  )}
                </div>

                {/* Title & Info */}
                <div className="space-y-1.5">
                  <h4 className="font-extrabold text-lg text-zinc-100 leading-snug tracking-tight">
                    {product.title}
                  </h4>
                  <p className="text-xs text-zinc-500 font-semibold uppercase">商品 ID: #{product.id}</p>
                </div>

                {/* Details Description */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    <span>宝贝描述</span>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-900 text-sm text-zinc-400 font-medium leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto">
                    {product.description || '本商品暂无详细描述，欢迎详询主播获取宝贝规格和实时实物演示。'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-24 text-center text-sm font-semibold text-zinc-500">
                商品数据加载失败或未上线
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
