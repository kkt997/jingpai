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

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [
    {
      id: 'init-1',
      nickname: '系统',
      message: '欢迎来到本直播间，实时竞拍已准备就绪！请文明发言，理性出价。',
      isMe: false,
      createdAt: new Date().toISOString(),
      type: 'system',
    },
    {
      id: 'init-2',
      nickname: '巅峰竞拍者1',
      message: '这件翡翠看起来品相极佳！',
      isMe: false,
      createdAt: new Date(Date.now() - 30000).toISOString(),
      type: 'user',
    },
    {
      id: 'init-3',
      nickname: '神秘买家3',
      message: '等一个开拍，期待！',
      isMe: false,
      createdAt: new Date(Date.now() - 15000).toISOString(),
      type: 'user',
    }
  ],

  addMessage: (msg) => {
    const newMessage: ChatMessage = {
      ...msg,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    set((state) => ({
      messages: [...state.messages.slice(-99), newMessage], // 最多保留最近 100 条
    }));
  },

  sendChatMessage: (ws, text, myNickname = '我') => {
    if (!text.trim()) return;

    // 1. 发送给服务端
    try {
      ws.send({
        type: MSG_CHAT,
        payload: { message: text },
      });
    } catch (e) {
      console.warn('WebSocket send failed, using simulated fallback:', e);
    }

    // 2. 本地模拟插入一条自己的弹幕
    get().addMessage({
      nickname: myNickname,
      message: text,
      isMe: true,
      createdAt: new Date().toISOString(),
      type: 'user',
    });
  },

  clearMessages: () => set({ messages: [] }),
}));
