import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConversationListItem, ConversationMessage, conversationApi } from '@jingpai/shared';

export default function ConversationPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const id = Number(conversationId);
  const [conversation, setConversation] = useState<ConversationListItem | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([conversationApi.detail(id), conversationApi.messages(id)])
      .then(async ([conversationRes, messagesRes]: any) => {
        setConversation(conversationRes.data || null);
        const nextMessages = messagesRes.data || [];
        setMessages(nextMessages);
        const latestId = nextMessages.length ? nextMessages[nextMessages.length - 1].id : undefined;
        if (latestId) await conversationApi.markRead(id, latestId);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content || !id) return;
    const res: any = await conversationApi.sendMessage(id, content);
    const message = res.data as ConversationMessage;
    setMessages((prev) => [...prev, message]);
    setConversation((prev) => (prev ? { ...prev, lastMessage: message, lastMessageAt: message.createdAt } : prev));
    setText('');
  };

  return (
    <div className="h-full flex flex-col bg-zinc-50">
      <div className="px-8 py-6 border-b border-zinc-200 bg-white flex items-center gap-4">
        <button type="button" onClick={() => navigate(-1)} className="text-zinc-500 hover:text-zinc-900">←</button>
        <div>
          <h1 className="text-xl font-bold text-zinc-900">{conversation?.peer.nickname || '会话'}</h1>
          <div className="text-sm text-zinc-500 mt-1">{conversation?.peer.role === 'MERCHANT' ? '商家' : '用户'}</div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-zinc-400">加载中...</div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
            {messages.length === 0 ? (
              <div className="text-sm text-zinc-400 text-center pt-10">还没有消息，发一句开始聊天吧</div>
            ) : (
              messages.map((message) => {
                const isMe = message.senderId !== conversation?.peer.id;
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
          </div>

          <div className="border-t border-zinc-200 bg-white px-8 py-4 flex items-end gap-3">
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
              disabled={!text.trim()}
              className="shrink-0 px-5 py-3 rounded-2xl bg-zinc-900 text-white text-sm font-medium disabled:opacity-50"
            >
              发送
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function formatTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
