import { create } from 'zustand';
import { RankItem, WsClient, MSG_BID } from '@jingpai/shared';

interface BidState {
  ranking: RankItem[];
  myRank: number | null;
  myLastBid: number | null;
  totalBidders: number;
  bidPending: boolean;
  lastBidResult: any | null;

  placeBid: (ws: WsClient, auctionId: number, amount: number) => void;
  onBidResult: (data: any) => void;
  onRankingUpdate: (data: any) => void;
  reset: () => void;
}

export const useBidStore = create<BidState>((set, get) => ({
  ranking: [],
  myRank: null,
  myLastBid: null,
  totalBidders: 0,
  bidPending: false,
  lastBidResult: null,

  placeBid: (ws, auctionId, amount) => {
    if (get().bidPending) return;
    set({ bidPending: true });
    ws.send({
      type: MSG_BID,
      payload: { auctionId, amount },
    });
  },

  onBidResult: (data) =>
    set((state) => ({
      bidPending: false,
      lastBidResult: data,
      myLastBid: data.accepted ? data.amount : state.myLastBid,
      myRank: data.accepted ? data.rank : state.myRank,
    })),

  onRankingUpdate: (data) =>
    set({
      ranking: data.ranking || data.top10 || [],
      myRank: data.myRank ?? null,
      totalBidders: data.totalBidders ?? 0,
    }),

  reset: () =>
    set({
      ranking: [],
      myRank: null,
      myLastBid: null,
      totalBidders: 0,
      bidPending: false,
      lastBidResult: null,
    }),
}));
