import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ConversationListItem,
  ConversationMessage,
  WsClient,
  conversationApi,
  MSG_CONVERSATION_READ,
  MSG_DIRECT_MESSAGE,
} from '@jingpai/shared';
import { useAuthStore } from '../stores/authStore';

export default function ConversationPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const [conversation, setConversation] = useState<ConversationListItem | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const id = Number(conversationId);

  const loadConversation = async () => {
    if (!id) return;
    const [conversationRes, messagesRes]: any = await Promise.all([
      conversationApi.detail(id),
      conversationApi.messages(id),
    ]);
    setConversation(conversationRes.data || null);
    setMessages(messagesRes.data || []);
    const lastMessageId = messagesRes.data?.length ? messagesRes.data[messagesRes.data.length - 1].id : undefined;
    if (lastMessageId) {
      await conversationApi.markRead(id, lastMessageId);
    }
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    loadConversation().finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !id) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WsClient(`${protocol}//${window.location.host}/ws`, token);

    const unsubDirect = ws.on(MSG_DIRECT_MESSAGE, async (msg) => {
      const payload = msg.data as { conversationId?: number; message?: ConversationMessage };
      if (payload?.conversationId !== id || !payload.message) return;
      const incomingMessage = payload.message;
      setMessages((prev) => [...prev, incomingMessage]);
      setConversation((prev) =>
        prev
          ? { ...prev, lastMessage: incomingMessage, lastMessageAt: incomingMessage.createdAt, unreadCount: 0 }
          : prev
      );
      await conversationApi.markRead(id, incomingMessage.id);
    });

    const unsubRead = ws.on(MSG_CONVERSATION_READ, () => {
      setConversation((prev) => (prev ? { ...prev, unreadCount: 0 } : prev));
    });

    ws.connect();
    return () => {
      unsubDirect();
      unsubRead();
      ws.disconnect();
    };
  }, [id]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content || !id || sending) return;
    setSending(true);
    try {
      const res: any = await conversationApi.sendMessage(id, content);
      const message = res.data as ConversationMessage;
      setMessages((prev) => [...prev, message]);
      setConversation((prev) =>
        prev ? { ...prev, lastMessage: message, lastMessageAt: message.createdAt } : prev
      );
      setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur-lg border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="text-gray-400 text-lg">&larr;</button>
        <div>
          <h1 className="text-lg font-bold">{conversation?.peer.nickname || '会话'}</h1>
          <div className="text-xs text-gray-500">{conversation?.peer.role === 'MERCHANT' ? '商家' : '用户'}</div>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">加载中...</div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center text-sm text-gray-500 pt-10">还没有消息，发一句开始聊天吧</div>
            ) : (
              messages.map((message) => {
                const isMe = message.senderId === currentUser?.id;
                return (
                  <div
                    key={message.id}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                        isMe ? 'bg-orange-500 text-white rounded-br-md' : 'bg-gray-900 border border-gray-800 text-gray-100 rounded-bl-md'
                      }`}
                    >
                      <div>{message.content}</div>
                      <div className={`mt-1 text-[10px] ${isMe ? 'text-orange-100/80' : 'text-gray-500'}`}>
                        {formatDateTime(message.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-gray-800 bg-gray-900/70 backdrop-blur px-4 py-3 flex items-end gap-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              maxLength={1000}
              placeholder="输入消息..."
              className="flex-1 resize-none rounded-2xl bg-gray-950 border border-gray-800 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/60"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="shrink-0 px-4 py-3 rounded-2xl bg-orange-500 text-white text-sm font-medium disabled:opacity-50"
            >
              发送
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function formatDateTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
