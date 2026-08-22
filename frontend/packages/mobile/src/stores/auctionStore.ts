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
    set((state) => ({
      auction: data.auction,
      product: data.auction?.product,
      mode: data.auction?.mode || 'OPEN',
      status: data.auction?.status || 'PENDING',
      currentPrice: data.auction?.currentPrice ?? state.currentPrice,
      bidCount: data.auction?.bidCount || 0,
      endTime: data.auction?.endTime || 0,
      depositRequired: data.auction?.depositRequired || false,
      depositAmount: data.auction?.depositAmount || 0,
      hasDeposit: data.auction?.hasDeposit || false,
      depositStatus: data.auction?.depositStatus || null,
      canRefund: data.auction?.canRefund || false,
      refundHint: data.auction?.refundHint || '',
    })),

  onNewBid: (data) =>
    set((state) => ({
      currentPrice: data.currentPrice ?? data.amount ?? state.currentPrice,
      bidCount: data.bidCount ?? state.bidCount,
    })),

  onAuctionStart: (data) =>
    set((state) => {
      const nextAuction = data.auction ?? {
        id: data.auctionId ?? data.id,
        productId: data.productId,
        roomId: state.auction?.roomId,
        merchantId: state.auction?.merchantId,
        mode: data.mode || 'OPEN',
        status: 'ACTIVE',
        startingPrice: data.startingPrice || 0,
        incrementAmount: data.incrementAmount || state.auction?.incrementAmount || 0,
        ceilingPrice: data.ceilingPrice ?? state.auction?.ceilingPrice ?? null,
        depositAmount: data.depositAmount || 0,
        durationSeconds: data.durationSeconds || 0,
        autoExtendSeconds: data.autoExtendSeconds || state.auction?.autoExtendSeconds || 0,
        currentPrice: data.currentPrice ?? data.startingPrice ?? state.currentPrice,
        winnerId: null,
        bidCount: 0,
        extendCount: 0,
        scheduledEnd: null,
        product: data.product ?? state.product,
        room: state.auction?.room,
      };
      return {
        auction: nextAuction,
        product: nextAuction.product ?? data.product ?? state.product,
        mode: nextAuction.mode || data.mode || 'OPEN',
        status: 'ACTIVE',
        endTime: data.endTime,
        currentPrice: nextAuction.currentPrice ?? data.currentPrice ?? data.startingPrice ?? state.currentPrice,
        bidCount: nextAuction.bidCount ?? 0,
        extendCount: nextAuction.extendCount ?? 0,
        depositRequired: data.depositRequired || false,
        depositAmount: data.depositAmount || 0,
        hasDeposit: data.hasDeposit ?? state.hasDeposit,
        depositStatus: data.depositStatus ?? state.depositStatus,
        canRefund: data.canRefund ?? state.canRefund,
        refundHint: data.refundHint ?? state.refundHint,
      };
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
    set((state) => ({
      endTime: data.endTime,
      status: data.status || state.status,
    })),

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
