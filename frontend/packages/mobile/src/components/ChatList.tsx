import { useEffect, useRef } from 'react';
import { ChatMessage } from '../stores/chatStore';
import { Bell, User } from 'lucide-react';

interface Props {
  messages: ChatMessage[];
}

export default function ChatList({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 平滑滚动到底部
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto flex flex-col scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
      <div className="mt-auto space-y-2 py-1">
      {messages.map((msg) => {
        const isSystem = msg.type === 'system' || msg.nickname === '系统';
        
        if (isSystem) {
          return (
            <div
              key={msg.id}
              className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/10 rounded-lg px-2.5 py-1.5 text-[11px] text-amber-400/90 leading-relaxed"
            >
              <Bell className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
              <div>
                <span className="font-bold text-amber-500 mr-1.5">[系统公告]</span>
                <span>{msg.message}</span>
              </div>
            </div>
          );
        }

        return (
          <div
            key={msg.id}
            className={`flex flex-col space-y-1 max-w-[85%] ${
              msg.isMe ? 'ml-auto items-end' : 'mr-auto items-start'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-semibold">
              {!msg.isMe && <User className="w-3 h-3 text-zinc-600" />}
              <span>{msg.nickname}</span>
              {msg.isMe && (
                <span className="px-1 py-0.2 rounded bg-brand/10 border border-brand/20 text-brand text-[8px] scale-90 origin-right">
                  我
                </span>
              )}
            </div>
            <div
              className={`rounded-2xl px-3 py-1.5 text-xs leading-snug break-words ${
                msg.isMe
                  ? 'bg-gradient-to-br from-brand/90 to-orange-500/90 text-white rounded-tr-none shadow-sm shadow-brand/10'
                  : 'bg-zinc-900/60 border border-zinc-800/80 text-zinc-200 rounded-tl-none'
              }`}
            >
              {msg.message}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
      </div>
    </div>
  );
}
