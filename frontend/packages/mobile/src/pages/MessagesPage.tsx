import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ConversationListItem,
  ConversationMessage,
  WsClient,
  conversationApi,
  MSG_CONVERSATION_UPDATED,
  MSG_DIRECT_MESSAGE,
} from '@jingpai/shared';
import { MessageCircleMore } from 'lucide-react';

export default function MessagesPage() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WsClient | null>(null);

  const fetchConversations = async () => {
    try {
      const res: any = await conversationApi.list();
      setConversations(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WsClient(`${protocol}//${window.location.host}/ws`, token);
    wsRef.current = ws;

    const unsubMessage = ws.on(MSG_DIRECT_MESSAGE, (msg) => {
      const payload = msg.data as { conversationId?: number; message?: ConversationMessage };
      if (!payload?.conversationId || !payload.message) return;

      setConversations((prev) => {
        const existing = prev.find((item) => item.id === payload.conversationId);
        if (!existing) {
          fetchConversations();
          return prev;
        }
        const updated = prev.map((item) =>
          item.id === payload.conversationId
            ? {
                ...item,
                lastMessage: payload.message || item.lastMessage,
                lastMessageAt: payload.message?.createdAt || item.lastMessageAt,
                unreadCount: item.unreadCount + 1,
              }
            : item
        );
        return updated.sort(sortConversation);
      });
    });

    const unsubUpdated = ws.on(MSG_CONVERSATION_UPDATED, () => {
      fetchConversations();
    });

    ws.connect();
    return () => {
      unsubMessage();
      unsubUpdated();
      ws.disconnect();
    };
  }, []);

  const orderedConversations = useMemo(
    () => [...conversations].sort(sortConversation),
    [conversations]
  );

  return (
    <>
      <header className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur-lg border-b border-gray-800 px-4 py-3">
        <h1 className="text-lg font-bold">消息</h1>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">加载中...</div>
      ) : orderedConversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400 px-6 text-center">
          <MessageCircleMore className="w-10 h-10 mb-3 opacity-70" />
          <div className="font-medium">暂无私聊会话</div>
          <div className="text-sm text-gray-500 mt-2">可从订单、商品详情、资料页或直播间入口发起私聊</div>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {orderedConversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              className="w-full text-left bg-gray-900 rounded-2xl border border-gray-800 p-4 active:bg-gray-800 transition"
              onClick={() => navigate(`/messages/${conversation.id}`)}
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold shrink-0">
                  {conversation.peer.nickname?.charAt(0) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold truncate">{conversation.peer.nickname}</div>
                    <div className="text-[11px] text-gray-500 shrink-0">
                      {formatTime(conversation.lastMessageAt)}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {conversation.peer.role === 'MERCHANT' ? '商家' : '用户'}
                  </div>
                  <div className="text-sm text-gray-300 mt-2 truncate">
                    {conversation.lastMessage?.content || '还没有消息'}
                  </div>
                </div>
                {conversation.unreadCount > 0 && (
                  <div className="min-w-5 h-5 px-1 rounded-full bg-orange-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                    {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function sortConversation(a: ConversationListItem, b: ConversationListItem) {
  return new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime();
}

function formatTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
