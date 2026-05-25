import { RankItem } from '@jingpai/shared';

interface Props {
  ranking: RankItem[];
}

function RankBadge({ rank }: { rank: number }) {
  const colors: Record<number, string> = {
    1: 'bg-yellow-500 text-black',
    2: 'bg-gray-400 text-black',
    3: 'bg-amber-700 text-white',
  };
  return (
    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${colors[rank] || 'bg-gray-700 text-gray-400'}`}>
      {rank}
    </span>
  );
}

export default function RankingList({ ranking }: Props) {
  if (ranking.length === 0) {
    return <div className="text-gray-600 text-center py-8 text-sm">暂无出价</div>;
  }

  return (
    <div className="space-y-2">
      {ranking.map((item) => (
        <div
          key={`${item.rank}-${item.alias}`}
          className={`flex items-center justify-between px-4 py-3 rounded-xl transition ${
            item.isMe
              ? 'bg-orange-500/15 border border-orange-500/30'
              : 'bg-white/5'
          }`}
        >
          <div className="flex items-center gap-3">
            <RankBadge rank={item.rank} />
            <span className={`font-medium ${item.isMe ? 'text-orange-400' : ''}`}>
              {item.alias}
              {item.isMe && ' (我)'}
            </span>
          </div>
          <div className="text-right">
            {item.amount !== null ? (
              <span className="font-bold text-lg tabular-nums">
                ¥{item.amount.toLocaleString()}
              </span>
            ) : (
              <span className="text-gray-600 text-sm tracking-widest">¥ • • • •</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
