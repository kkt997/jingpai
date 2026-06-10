export interface UserSummary {
  id: number;
  nickname: string;
  avatarUrl: string;
  role: 'USER' | 'MERCHANT';
}

export interface FollowStatus {
  targetUserId: number;
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
}

export interface FollowListItem extends UserSummary {
  followedAt: string;
}

export interface UserProfileSummary extends UserSummary {
  createdAt: string;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
}

export interface MerchantProfileSummary extends UserProfileSummary {
  productCount?: number;
}

export interface ConversationMessage {
  id: number;
  conversationId: number;
  senderId: number;
  type: 'TEXT';
  content: string;
  createdAt: string;
  sender?: UserSummary;
}

export interface ConversationListItem {
  id: number;
  kind: 'DIRECT';
  peer: UserSummary;
  lastMessage: ConversationMessage | null;
  lastMessageAt?: string | null;
  unreadCount: number;
}
