import { Product, AuctionStatus } from './auction';

export interface ShowcaseItem {
  id: number;
  productId: number;
  product: Product;
  status: AuctionStatus;
  startingPrice: number;
  currentPrice: number;
  finalPrice?: number;
  winnerNickname?: string;
  sequence: number;
}
