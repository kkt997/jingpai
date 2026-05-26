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
  depositRequired: boolean;
  depositAmount: number;
  hasDeposit: boolean;

  initFromRoomState: (data: any) => void;
  onNewBid: (data: any) => void;
  onAuctionStart: (data: any) => void;
  onAuctionExtend: (data: any) => void;
  onAuctionEnd: (data: any) => void;
  onCountdownSync: (data: any) => void;
  setDepositPaid: () => void;
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
  depositRequired: false,
  depositAmount: 0,
  hasDeposit: false,

  initFromRoomState: (data) =>
    set({
      auction: data.auction,
      product: data.auction?.product,
      mode: data.auction?.mode || 'OPEN',
      status: data.auction?.status || 'PENDING',
      currentPrice: data.auction?.currentPrice || 0,
      bidCount: data.auction?.bidCount || 0,
      endTime: data.auction?.endTime || 0,
      depositRequired: data.auction?.depositRequired || false,
      depositAmount: data.auction?.depositAmount || 0,
      hasDeposit: data.auction?.hasDeposit || false,
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
      depositRequired: data.depositRequired || false,
      depositAmount: data.depositAmount || 0,
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

  setDepositPaid: () => set({ hasDeposit: true }),

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
      depositRequired: false,
      depositAmount: 0,
      hasDeposit: false,
    }),
}));
