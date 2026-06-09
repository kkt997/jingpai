import { create } from 'zustand';
import { Auction, AuctionStatus, AuctionMode, Product, DepositStatus } from '@jingpai/shared';

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
  depositStatus: DepositStatus | null;
  canRefund: boolean;
  refundHint: string;

  initFromRoomState: (data: any) => void;
  onNewBid: (data: any) => void;
  onAuctionStart: (data: any) => void;
  onAuctionExtend: (data: any) => void;
  onAuctionEnd: (data: any) => void;
  onCountdownSync: (data: any) => void;
  setDepositPaid: () => void;
  setDepositRefunded: () => void;
  setDepositState: (data: { hasDeposit: boolean; depositStatus: DepositStatus | null; canRefund: boolean; refundHint: string }) => void;
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
  depositStatus: null,
  canRefund: false,
  refundHint: '',

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
      depositStatus: data.auction?.depositStatus || null,
      canRefund: data.auction?.canRefund || false,
      refundHint: data.auction?.refundHint || '',
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
    set({
      status: (data.result as string)?.toUpperCase() as AuctionStatus || 'COMPLETED',
      canRefund: false,
      refundHint: '竞拍已结束，保证金将在直播结束后自动退回平台钱包。',
    }),

  onCountdownSync: (data) =>
    set({
      endTime: data.endTime,
      status: data.status,
    }),

  setDepositPaid: () =>
    set({
      hasDeposit: true,
      depositStatus: 'FROZEN',
      canRefund: true,
      refundHint: '参拍保证金由平台托管，可随时申请退还；直播结束后自动退回',
    }),

  setDepositRefunded: () =>
    set({
      hasDeposit: false,
      depositStatus: 'REFUNDED',
      canRefund: false,
      refundHint: '保证金已退回平台钱包',
    }),

  setDepositState: (data) =>
    set({
      hasDeposit: data.hasDeposit,
      depositStatus: data.depositStatus,
      canRefund: data.canRefund,
      refundHint: data.refundHint,
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
      maxExtendCount: 10,
      depositRequired: false,
      depositAmount: 0,
      hasDeposit: false,
      depositStatus: null,
      canRefund: false,
      refundHint: '',
    }),
}));
