import { create } from 'zustand';
import { ConnectionStatus } from '@jingpai/shared';

interface RoomState {
  roomId: number | null;
  roomTitle: string;
  streamUrl: string;
  onlineCount: number;
  connectionStatus: ConnectionStatus;

  setRoom: (roomId: number, title?: string) => void;
  setRoomInfo: (info: { title?: string; streamUrl?: string }) => void;
  setOnlineCount: (count: number) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  roomId: null,
  roomTitle: '',
  streamUrl: '',
  onlineCount: 0,
  connectionStatus: 'disconnected',

  setRoom: (roomId, title) =>
    set({ roomId, roomTitle: title || '' }),

  setRoomInfo: (info) =>
    set((s) => ({
      roomTitle: info.title || s.roomTitle,
      streamUrl: info.streamUrl || s.streamUrl,
    })),

  setOnlineCount: (count) =>
    set({ onlineCount: count }),

  setConnectionStatus: (status) =>
    set({ connectionStatus: status }),

  reset: () =>
    set({
      roomId: null,
      roomTitle: '',
      streamUrl: '',
      onlineCount: 0,
      connectionStatus: 'disconnected',
    }),
}));
