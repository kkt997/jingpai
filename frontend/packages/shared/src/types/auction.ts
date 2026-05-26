export type UserRole = 'USER' | 'MERCHANT';
export type AuctionStatus = 'DRAFT' | 'PENDING' | 'ACTIVE' | 'EXTENDED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type AuctionMode = 'OPEN' | 'BLIND';
export type OrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED';
export type RoomStatus = 'PREPARING' | 'LIVE' | 'ENDED';

export interface User {
  id: number;
  phone: string;
  email: string;
  nickname: string;
  avatarUrl: string;
  role: UserRole;
  createdAt: string;
}

export interface Product {
  id: number;
  merchantId: number;
  title: string;
  description: string;
  images: string[];
  category: string;
}

export interface LiveRoom {
  id: number;
  merchantId: number;
  title: string;
  coverUrl: string;
  streamUrl: string;
  status: RoomStatus;
  onlineCount: number;
}

export interface Auction {
  id: number;
  productId: number;
  roomId: number;
  merchantId: number;
  mode: AuctionMode;
  status: AuctionStatus;
  startingPrice: number;
  incrementAmount: number;
  ceilingPrice: number | null;
  depositAmount: number;
  durationSeconds: number;
  autoExtendSeconds: number;
  currentPrice: number;
  winnerId: number | null;
  bidCount: number;
  extendCount: number;
  scheduledEnd: string | null;
  product: Product;
  room: LiveRoom;
}

export type DepositStatus = 'FROZEN' | 'DEDUCTED' | 'REFUNDED';

export interface Deposit {
  id: number;
  userId: number;
  auctionId: number;
  amount: number;
  status: DepositStatus;
  createdAt: string;
  auction?: Auction;
}

export interface RankItem {
  rank: number;
  alias: string;
  amount: number | null;
  isMe: boolean;
}

export interface Order {
  id: number;
  orderNo: string;
  auctionId: number;
  buyerId: number;
  sellerId: number;
  productId: number;
  finalPrice: number;
  status: OrderStatus;
  paymentTime: string | null;
  expireTime: string;
  createdAt: string;
  product: Product;
  auction: Auction;
}
