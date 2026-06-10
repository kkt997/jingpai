import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ConversationListItem,
  ConversationMessage,
  WsClient,
  conversationApi,
  MSG_CONVERSATION_UPDATED,
  MSG_DIRECT_MESSAGE,
} from '@jingpai/shared';

export default function MessagesPage() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageLoading, setMessageLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const wsRef = useRef<WsClient | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async (preferredId?: number | null) => {
    const res: any = await conversationApi.list();
    const items = res.data || [];
    setConversations(items);

    const nextId = preferredId ?? selectedConversationId ?? items[0]?.id ?? null;
    if (nextId) {
      setSelectedConversationId(nextId);
      await loadMessages(nextId);
    } else {
      setSelectedConversationId(null);
      setMessages([]);
    }
  };

  const loadMessages = async (conversationId: number) => {
    setMessageLoading(true);
    try {
      const res: any = await conversationApi.messages(conversationId);
      const nextMessages = res.data || [];
      setMessages(nextMessages);
      const latestId = nextMessages.length ? nextMessages[nextMessages.length - 1].id : undefined;
      if (latestId) {
        await conversationApi.markRead(conversationId, latestId);
      }
    } finally {
      setMessageLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WsClient(`${protocol}//${window.location.host}/ws`, token);
    wsRef.current = ws;

    const unsubMessage = ws.on(MSG_DIRECT_MESSAGE, async (msg) => {
      const payload = msg.data as { conversationId?: number; message?: ConversationMessage };
      if (!payload?.conversationId || !payload.message) return;
      const incomingMessage = payload.message;

      setConversations((prev) => {
        const idx = prev.findIndex((item) => item.id === payload.conversationId);
        if (idx === -1) {
          fetchConversations(payload.conversationId);
          return prev;
        }
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          lastMessage: incomingMessage,
          lastMessageAt: incomingMessage.createdAt,
          unreadCount: selectedConversationId === payload.conversationId ? 0 : updated[idx].unreadCount + 1,
        };
        updated.sort(sortConversation);
        return updated;
      });

      if (selectedConversationId === payload.conversationId) {
        setMessages((prev) => [...prev, incomingMessage]);
        await conversationApi.markRead(payload.conversationId, incomingMessage.id);
      }
    });

    const unsubUpdated = ws.on(MSG_CONVERSATION_UPDATED, () => {
      fetchConversations(selectedConversationId);
    });

    ws.connect();
    return () => {
      unsubMessage();
      unsubUpdated();
      ws.disconnect();
    };
  }, [selectedConversationId]);

  const selectedConversation = conversations.find((item) => item.id === selectedConversationId) || null;

  const handleSelectConversation = async (conversationId: number) => {
    setSelectedConversationId(conversationId);
    setConversations((prev) => prev.map((item) => (item.id === conversationId ? { ...item, unreadCount: 0 } : item)));
    await loadMessages(conversationId);
  };

  const handleSend = async () => {
    const content = text.trim();
    if (!selectedConversationId || !content || sending) return;
    setSending(true);
    try {
      const res: any = await conversationApi.sendMessage(selectedConversationId, content);
      const message = res.data as ConversationMessage;
      setMessages((prev) => [...prev, message]);
      setConversations((prev) => {
        const updated = prev.map((item) =>
          item.id === selectedConversationId
            ? { ...item, lastMessage: message, lastMessageAt: message.createdAt }
            : item
        );
        return updated.sort(sortConversation);
      });
      setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 py-6 border-b border-zinc-200 bg-white">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">消息中心</h1>
        <p className="text-sm text-zinc-500 mt-1">处理与用户和商家的实时私聊沟通</p>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-zinc-400">加载中...</div>
      ) : (
        <div className="flex-1 grid grid-cols-[340px_1fr] min-h-0">
          <aside className="border-r border-zinc-200 bg-white overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="px-6 py-12 text-sm text-zinc-400 text-center">暂无私聊会话</div>
            ) : (
              <div className="p-4 space-y-3">
                {conversations.map((conversation) => (
                  <button
                    type="button"
                    key={conversation.id}
                    onClick={() => handleSelectConversation(conversation.id)}
                    className={`w-full text-left rounded-2xl border p-4 transition ${
                      selectedConversationId === conversation.id
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-200 bg-zinc-50 hover:bg-white hover:border-zinc-300 text-zinc-900'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold shrink-0">
                        {conversation.peer.nickname?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold truncate">{conversation.peer.nickname}</div>
                          <div className={`text-[11px] shrink-0 ${selectedConversationId === conversation.id ? 'text-zinc-300' : 'text-zinc-400'}`}>
                            {formatTime(conversation.lastMessageAt)}
                          </div>
                        </div>
                        <div className={`text-xs mt-1 ${selectedConversationId === conversation.id ? 'text-zinc-300' : 'text-zinc-500'}`}>
                          {conversation.peer.role === 'MERCHANT' ? '商家' : '用户'}
                        </div>
                        <div className={`text-sm mt-2 truncate ${selectedConversationId === conversation.id ? 'text-zinc-100' : 'text-zinc-600'}`}>
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
          </aside>

          <section className="flex flex-col min-h-0 bg-zinc-50/60">
            {!selectedConversation ? (
              <div className="flex-1 flex items-center justify-center text-zinc-400">请选择一个会话开始查看</div>
            ) : (
              <>
                <div className="px-6 py-5 border-b border-zinc-200 bg-white flex items-center justify-between gap-4">
                  <div>
                    <div className="text-lg font-bold text-zinc-900">{selectedConversation.peer.nickname}</div>
                    <div className="text-sm text-zinc-500 mt-1">{selectedConversation.peer.role === 'MERCHANT' ? '商家' : '用户'}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/users/${selectedConversation.peer.id}`)}
                    className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-700 hover:bg-zinc-50"
                  >
                    查看资料
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                  {messageLoading ? (
                    <div className="text-sm text-zinc-400 text-center pt-10">消息加载中...</div>
                  ) : messages.length === 0 ? (
                    <div className="text-sm text-zinc-400 text-center pt-10">还没有消息，发一句开始聊天吧</div>
                  ) : (
                    messages.map((message) => {
                      const isMe = message.senderId !== selectedConversation.peer.id;
                      return (
                        <div key={message.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                              isMe
                                ? 'bg-zinc-900 text-white rounded-br-md'
                                : 'bg-white border border-zinc-200 text-zinc-900 rounded-bl-md'
                            }`}
                          >
                            <div>{message.content}</div>
                            <div className={`mt-1 text-[11px] ${isMe ? 'text-zinc-300' : 'text-zinc-400'}`}>
                              {formatTime(message.createdAt)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                <div className="border-t border-zinc-200 bg-white px-6 py-4 flex items-end gap-3">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={2}
                    maxLength={1000}
                    placeholder="输入消息..."
                    className="flex-1 resize-none rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400"
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!text.trim() || sending}
                    className="shrink-0 px-5 py-3 rounded-2xl bg-zinc-900 text-white text-sm font-medium disabled:opacity-50"
                  >
                    发送
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
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
