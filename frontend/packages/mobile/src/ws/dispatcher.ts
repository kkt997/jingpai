import {
  WsClient,
  MSG_ROOM_STATE,
  MSG_NEW_BID,
  MSG_BID_RESULT,
  MSG_AUCTION_START,
  MSG_AUCTION_EXTEND,
  MSG_AUCTION_END,
  MSG_COUNTDOWN_SYNC,
  MSG_USER_COUNT,
  MSG_JOIN_ROOM,
} from '@jingpai/shared';
import { useAuctionStore } from '../stores/auctionStore';
import { useBidStore } from '../stores/bidStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useRoomStore } from '../stores/roomStore';

/**
 * WsDispatcher is a pure logic layer that connects WebSocket messages to Zustand stores.
 * Components never interact with WS directly — they read from stores and call store actions.
 */
export function createWsDispatcher(ws: WsClient, roomId: number) {
  const auction = useAuctionStore.getState;
  const bidStore = useBidStore.getState;
  const notify = useNotificationStore.getState;
  const room = useRoomStore.getState;

  const unsubscribers: (() => void)[] = [];

  // Connection status tracking
  unsubscribers.push(
    ws.onStatus((status) => {
      room().setConnectionStatus(status);
      if (status === 'connected') {
        ws.send({ type: MSG_JOIN_ROOM, payload: { roomId } });
      }
    })
  );

  // Room state (full sync on join/reconnect)
  unsubscribers.push(
    ws.on(MSG_ROOM_STATE, (msg) => {
      const data = msg.data as any;
      auction().initFromRoomState(data);
      if (data?.auction?.ranking) {
        bidStore().onRankingUpdate(data.auction);
      }
    })
  );

  // New bid broadcast
  unsubscribers.push(
    ws.on(MSG_NEW_BID, (msg) => {
      const data = msg.data as any;
      const prevRank = bidStore().myRank;

      auction().onNewBid(data);
      if (data?.ranking) {
        bidStore().onRankingUpdate(data);
      }

      // "被超越" notification — rank dropped
      const newRank = bidStore().myRank;
      if (prevRank && newRank && newRank > prevRank) {
        const mode = auction().mode;
        const message =
          mode === 'BLIND'
            ? `你的排名从第${prevRank}名降至第${newRank}名`
            : `你被超越了！当前价 ¥${data.currentPrice?.toLocaleString()}`;
        notify().push({ type: 'bid_overtaken', message, duration: 3000 });
      }
    })
  );

  // Bid result (only sent to the bidder)
  unsubscribers.push(
    ws.on(MSG_BID_RESULT, (msg) => {
      const data = msg.data as any;
      bidStore().onBidResult(data);
      if (data?.accepted && data?.rank === 1) {
        notify().push({ type: 'bid_leading', message: '你当前出价最高！', duration: 2000 });
      }
    })
  );

  // Auction start
  unsubscribers.push(
    ws.on(MSG_AUCTION_START, (msg) => {
      auction().onAuctionStart(msg.data as any);
    })
  );

  // Auction extend
  unsubscribers.push(
    ws.on(MSG_AUCTION_EXTEND, (msg) => {
      const data = msg.data as any;
      auction().onAuctionExtend(data);
      notify().push({
        type: 'auction_extending',
        message: `竞拍延时 ${data.extendSeconds} 秒！`,
        duration: 3000,
      });
    })
  );

  // Auction end
  unsubscribers.push(
    ws.on(MSG_AUCTION_END, (msg) => {
      const data = msg.data as any;
      auction().onAuctionEnd(data);

      if (data.result === 'completed') {
        const myRank = bidStore().myRank;
        if (myRank === 1) {
          notify().push({
            type: 'auction_won',
            message: `恭喜！你以 ¥${data.finalPrice?.toLocaleString()} 拍得商品！`,
            duration: 5000,
          });
        } else if (myRank) {
          notify().push({
            type: 'auction_lost',
            message: '竞拍结束，很遗憾未能中标',
            duration: 4000,
          });
        }
      } else if (data.result === 'failed') {
        notify().push({
          type: 'auction_lost',
          message: '竞拍流拍，无人出价',
          duration: 3000,
        });
      }
    })
  );

  // Countdown sync
  unsubscribers.push(
    ws.on(MSG_COUNTDOWN_SYNC, (msg) => {
      auction().onCountdownSync(msg.data as any);
    })
  );

  // User count
  unsubscribers.push(
    ws.on(MSG_USER_COUNT, (msg) => {
      const data = msg.data as any;
      room().setOnlineCount(data.count || 0);
    })
  );

  // Cleanup function
  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}
