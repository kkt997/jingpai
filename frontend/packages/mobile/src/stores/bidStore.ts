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
    const result = ws.send({
      type: MSG_BID,
      payload: { auctionId, amount },
    });
    if (!result.ok) {
      const status = ws.getStatus();
      set({
        bidPending: false,
        lastBidResult: {
          accepted: false,
          msg: status === 'reconnecting' || status === 'connecting'
            ? '正在重连，请稍后再试'
            : '连接已断开，请刷新后重试',
        },
      });
    }
  },

  onBidResult: (data) =>
    set((state) => ({
      bidPending: false,
      lastBidResult: data,
      myLastBid: data.accepted ? data.amount : state.myLastBid,
      myRank: data.accepted ? data.rank : state.myRank,
    })),

  onRankingUpdate: (data) =>
    set((state) => {
      const ranking = data.ranking || data.top10 || [];
      const inferredRank = ranking.find((item: RankItem) => item.isMe)?.rank;
      return {
        ranking,
        myRank: data.myRank ?? inferredRank ?? state.myRank,
        totalBidders: data.totalBidders ?? state.totalBidders,
      };
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
