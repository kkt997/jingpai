import { create } from 'zustand';
import { auctionApi, ShowcaseItem } from '@jingpai/shared';

interface ShowcaseState {
  showcaseItems: ShowcaseItem[];
  loading: boolean;
  loadShowcase: (roomId: number) => Promise<void>;
  onNewBid: (currentPrice?: number) => void;
  onAuctionStart: (data: any) => void;
  onAuctionEnd: (data: any) => void;
  reset: () => void;
}

export const useShowcaseStore = create<ShowcaseState>((set) => ({
  showcaseItems: [],
  loading: false,

  loadShowcase: async (roomId) => {
    set({ loading: true });
    try {
      const res: any = await auctionApi.showcase(roomId);
      set({ showcaseItems: res.data || [], loading: false });
    } catch (err) {
      console.warn('[Showcase] Failed to load room showcase:', err);
      set({ showcaseItems: [], loading: false });
    }
  },

  onNewBid: (currentPrice) => {
    if (currentPrice == null) return;
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
      showcaseItems: state.showcaseItems.map((item) =>
        item.id === data.auctionId || item.id === data.id
          ? {
              ...item,
              status: 'ACTIVE',
              startingPrice: data.startingPrice ?? item.startingPrice,
              currentPrice: data.startingPrice ?? item.currentPrice,
              product: data.product || item.product,
            }
          : item
      ),
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
            winnerNickname: isCompleted ? data.winnerNickname : undefined,
          };
        }
        return item;
      }),
    }));
  },

  reset: () => set({ showcaseItems: [], loading: false }),
}));
