import { create } from 'zustand';
import { WsClient, MSG_CHAT } from '@jingpai/shared';

export interface ChatMessage {
  id: string;
  nickname: string;
  message: string;
  isMe: boolean;
  createdAt: string;
  type: 'user' | 'system';
}

interface ChatState {
  messages: ChatMessage[];
  addMessage: (msg: Omit<ChatMessage, 'id'>) => void;
  sendChatMessage: (ws: WsClient, text: string, myNickname?: string) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],

  addMessage: (msg) => {
    const newMessage: ChatMessage = {
      ...msg,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    set((state) => ({
      messages: [...state.messages.slice(-99), newMessage], // 最多保留最近 100 条
    }));
  },

  sendChatMessage: (ws, text) => {
    if (!text.trim()) return;

    // 1. 发送给服务端
    try {
      ws.send({
        type: MSG_CHAT,
        payload: { message: text },
      });
    } catch (e) {
      console.warn('WebSocket send failed:', e);
    }
  },

  clearMessages: () => set({ messages: [] }),
}));
