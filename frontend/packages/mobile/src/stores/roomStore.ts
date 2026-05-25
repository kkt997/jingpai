import { create } from 'zustand';
import { ConnectionStatus } from '@jingpai/shared';

interface RoomState {
  roomId: number | null;
  roomTitle: string;
  onlineCount: number;
  connectionStatus: ConnectionStatus;

  setRoom: (roomId: number, title?: string) => void;
  setOnlineCount: (count: number) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  roomId: null,
  roomTitle: '',
  onlineCount: 0,
  connectionStatus: 'disconnected',

  setRoom: (roomId, title) =>
    set({ roomId, roomTitle: title || '' }),

  setOnlineCount: (count) =>
    set({ onlineCount: count }),

  setConnectionStatus: (status) =>
    set({ connectionStatus: status }),

  reset: () =>
    set({
      roomId: null,
      roomTitle: '',
      onlineCount: 0,
      connectionStatus: 'disconnected',
    }),
}));
