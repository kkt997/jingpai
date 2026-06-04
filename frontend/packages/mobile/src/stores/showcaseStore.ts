import { create } from 'zustand';
import { ShowcaseItem } from '@jingpai/shared';
import { useAuctionStore } from './auctionStore';

interface ShowcaseState {
  showcaseItems: ShowcaseItem[];
  loading: boolean;
  loadShowcase: (roomId: number) => Promise<void>;
  onNewBid: (currentPrice: number) => void;
  onAuctionStart: (data: any) => void;
  onAuctionEnd: (data: any) => void;
  reset: () => void;
}

const mockShowcaseData: Omit<ShowcaseItem, 'id' | 'productId'>[] = [
  {
    product: {
      id: 10,
      title: '皇家帝王绿翡翠无事牌吊坠',
      description: '精选老坑冰种帝王绿翡翠，水头十足，质地细腻纯净。附带国家权威珠宝检测证书，支持全国复检。',
      images: ['https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&auto=format&fit=crop&q=60'],
      category: '珠宝玉石',
    } as any,
    status: 'COMPLETED',
    startingPrice: 5000,
    currentPrice: 9800,
    finalPrice: 9800,
    winnerNickname: '神秘买家2',
    sequence: 1,
  },
  {
    product: {
      id: 11,
      title: '新疆羊脂白玉双面雕观音牌',
      description: '顶级羊脂白玉挂件，雕工细腻，脂份温润如酥，观音法相端庄，保佑出入平安。',
      images: ['https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=600&auto=format&fit=crop&q=60'],
      category: '珠宝玉石',
    } as any,
    status: 'ACTIVE',
    startingPrice: 3000,
    currentPrice: 3000,
    sequence: 2,
  },
  {
    product: {
      id: 12,
      title: '复古天然红蓝宝石18K金戒指',
      description: '古典奢华复古工艺设计，主石为高净度红蓝宝石，折射璀璨，配以精致辅钻。',
      images: ['https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&auto=format&fit=crop&q=60'],
      category: '奢侈配饰',
    } as any,
    status: 'PENDING',
    startingPrice: 8000,
    currentPrice: 8000,
    sequence: 3,
  }
];

export const useShowcaseStore = create<ShowcaseState>((set) => ({
  showcaseItems: [],
  loading: false,

  loadShowcase: async (roomId) => {
    console.log('[Showcase] Loading items for room:', roomId);
    set({ loading: true });
    try {
      // 本地暂无接口实现，我们将直接模拟加载失败以触发降级 fallback
      // 如果未来后端实现了 showcase 接口，可使用下面这行：
      // const res = await roomApi.getShowcase(roomId);
      // set({ showcaseItems: res.data, loading: false });
      throw new Error('Fallback to Mock');
    } catch {
      // 优雅降级：用 Mock 数据，并动态和当前竞拍状态拼接
      const currentAuction = useAuctionStore.getState().auction;
      const currentStatus = useAuctionStore.getState().status;
      const currentPrice = useAuctionStore.getState().currentPrice;

      const items = mockShowcaseData.map((item, index) => {
        // 如果是第二件（进行中）拍品，且真实房间里竞拍已配置
        if (item.sequence === 2 && currentAuction) {
          return {
            id: currentAuction.id,
            productId: currentAuction.productId,
            product: currentAuction.product,
            status: currentStatus,
            startingPrice: currentAuction.startingPrice,
            currentPrice: currentPrice || currentAuction.startingPrice,
            sequence: 2,
          } as ShowcaseItem;
        }
        return {
          ...item,
          id: 100 + index,
          productId: 200 + index,
        } as ShowcaseItem;
      });

      set({ showcaseItems: items, loading: false });
    }
  },

  onNewBid: (currentPrice) => {
    set((state) => ({
      showcaseItems: state.showcaseItems.map((item) =>
        item.status === 'ACTIVE' || item.status === 'EXTENDED'
          ? { ...item, currentPrice }
          : item
      ),
    }));
  },

  onAuctionStart: (data) => {
    set((state) => ({
      showcaseItems: state.showcaseItems.map((item) => {
        if (item.sequence === 2) {
          return {
            ...item,
            id: data.id,
            status: 'ACTIVE',
            startingPrice: data.startingPrice || 3000,
            currentPrice: data.startingPrice || 3000,
            product: data.product || item.product,
          };
        }
        return item;
      }),
    }));
  },

  onAuctionEnd: (data) => {
    set((state) => ({
      showcaseItems: state.showcaseItems.map((item) => {
        if (item.status === 'ACTIVE' || item.status === 'EXTENDED') {
          const isCompleted = data.result === 'completed';
          return {
            ...item,
            status: isCompleted ? 'COMPLETED' : 'FAILED',
            finalPrice: isCompleted ? data.finalPrice : undefined,
            winnerNickname: isCompleted ? (data.winnerNickname || '巅峰竞投者') : undefined,
          };
        }
        return item;
      }),
    }));
  },

  reset: () => set({ showcaseItems: [], loading: false }),
}));
