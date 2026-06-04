import { RankItem } from '@jingpai/shared';
import { Trophy, Award, Crown } from 'lucide-react';

interface Props {
  ranking: RankItem[];
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-lg shadow-yellow-500/10">
        <Crown className="w-4 h-4 fill-current" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-zinc-300 to-zinc-400 text-black shadow-lg shadow-zinc-400/10">
        <Trophy className="w-3.5 h-3.5" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-lg shadow-amber-700/10">
        <Award className="w-3.5 h-3.5" />
      </div>
    );
  }
  return (
    <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-zinc-800 text-zinc-400 border border-zinc-700/40">
      {rank}
    </span>
  );
}

export default function RankingList({ ranking }: Props) {
  if (ranking.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
        <Trophy className="w-8 h-8 text-zinc-700 mb-2 animate-bounce" />
        <p className="text-xs font-semibold">暂无出价记录，快抢先出价吧！</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {ranking.map((item) => (
        <div
          key={`${item.rank}-${item.alias}`}
          className={`flex items-center justify-between px-4 py-3 rounded-xl transition duration-200 border ${
            item.isMe
              ? 'bg-brand/10 border-brand/30 shadow-sm shadow-brand/5'
              : 'bg-zinc-900/40 border-zinc-800/40 hover:bg-zinc-900/60'
          }`}
        >
          <div className="flex items-center gap-3">
            <RankBadge rank={item.rank} />
            <span className={`text-sm font-semibold tracking-tight ${item.isMe ? 'text-brand' : 'text-zinc-200'}`}>
              {item.alias}
              {item.isMe && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-brand/10 text-[10px] font-bold text-brand">我</span>}
            </span>
          </div>
          <div className="text-right">
            {item.amount !== null ? (
              <span className={`font-bold text-base tabular-nums tracking-tight ${item.rank === 1 ? 'text-amber-400' : 'text-zinc-100'}`}>
                ¥{item.amount.toLocaleString()}
              </span>
            ) : (
              <span className="text-zinc-600 text-xs font-bold tracking-widest">¥ • • • •</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
