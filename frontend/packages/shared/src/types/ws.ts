export interface ClientMessage {
  type: string;
  seq: number;
  payload: Record<string, unknown>;
}

export interface ServerMessage {
  type: string;
  seq?: number;
  code: number;
  msg?: string;
  data?: unknown;
  ts: number;
}

// C2S types
export const MSG_PING = 'ping';
export const MSG_JOIN_ROOM = 'join_room';
export const MSG_LEAVE_ROOM = 'leave_room';
export const MSG_BID = 'bid';
export const MSG_SYNC_TIME = 'sync_time';

// S2C types
export const MSG_PONG = 'pong';
export const MSG_ROOM_STATE = 'room_state';
export const MSG_BID_RESULT = 'bid_result';
export const MSG_NEW_BID = 'new_bid';
export const MSG_RANKING_UPDATE = 'ranking_update';
export const MSG_AUCTION_START = 'auction_start';
export const MSG_AUCTION_EXTEND = 'auction_extend';
export const MSG_AUCTION_END = 'auction_end';
export const MSG_COUNTDOWN_SYNC = 'countdown_sync';
export const MSG_USER_COUNT = 'user_count';
export const MSG_TIME_SYNC = 'time_sync';
export const MSG_ERROR = 'error';
