import { create } from 'zustand';
import { Auction, AuctionStatus, AuctionMode, Product } from '@jingpai/shared';

interface AuctionState {
  auction: Auction | null;
  product: Product | null;
  mode: AuctionMode;
  status: AuctionStatus;
  currentPrice: number;
  bidCount: number;
  endTime: number;
  extendCount: number;
  maxExtendCount: number;

  initFromRoomState: (data: any) => void;
  onNewBid: (data: any) => void;
  onAuctionStart: (data: any) => void;
  onAuctionExtend: (data: any) => void;
  onAuctionEnd: (data: any) => void;
  onCountdownSync: (data: any) => void;
  reset: () => void;
}

export const useAuctionStore = create<AuctionState>((set) => ({
  auction: null,
  product: null,
  mode: 'OPEN',
  status: 'PENDING',
  currentPrice: 0,
  bidCount: 0,
  endTime: 0,
  extendCount: 0,
  maxExtendCount: 10,

  initFromRoomState: (data) =>
    set({
      auction: data.auction,
      product: data.auction?.product,
      mode: data.auction?.mode || 'OPEN',
      status: data.auction?.status || 'PENDING',
      currentPrice: data.auction?.currentPrice || 0,
      bidCount: data.auction?.bidCount || 0,
      endTime: data.auction?.endTime || 0,
    }),

  onNewBid: (data) =>
    set({
      currentPrice: data.currentPrice ?? data.amount,
      bidCount: data.bidCount,
    }),

  onAuctionStart: (data) =>
    set({
      status: 'ACTIVE',
      endTime: data.endTime,
      currentPrice: data.startingPrice || 0,
    }),

  onAuctionExtend: (data) =>
    set({
      status: 'EXTENDED',
      endTime: data.newEndTime,
      extendCount: data.extendCount,
    }),

  onAuctionEnd: (data) =>
    set({ status: (data.result as string)?.toUpperCase() as AuctionStatus || 'COMPLETED' }),

  onCountdownSync: (data) =>
    set({
      endTime: data.endTime,
      status: data.status,
    }),

  reset: () =>
    set({
      auction: null,
      product: null,
      mode: 'OPEN',
      status: 'PENDING',
      currentPrice: 0,
      bidCount: 0,
      endTime: 0,
      extendCount: 0,
    }),
}));
