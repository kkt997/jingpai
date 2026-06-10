import { AnimatePresence, motion } from 'framer-motion';
import { useNotificationStore, NotificationType } from '../stores/notificationStore';
import { Trophy, Flame, AlertCircle, Clock, CheckCircle2, XCircle, Gavel, Sparkles } from 'lucide-react';

const getNotificationConfig = (type: NotificationType) => {
  switch (type) {
    case 'auction_start':
      return {
        icon: Gavel,
        colorClass: 'text-brand drop-shadow-[0_0_8px_rgba(255,59,48,0.8)]',
        bgClass: 'bg-gradient-to-r from-brand/20 to-orange-500/20 border-brand/50',
        animation: {
          initial: { opacity: 0, y: -50, scale: 0.5, rotateX: -90 },
          animate: { opacity: 1, y: 0, scale: 1.1, rotateX: 0, transition: { type: 'spring', bounce: 0.6 } },
          exit: { opacity: 0, y: -20, scale: 0.8 },
        },
      };
    case 'bid_leading':
      return {
        icon: Flame,
        colorClass: 'text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.8)] animate-pulse',
        bgClass: 'bg-gradient-to-r from-orange-500/20 to-amber-500/20 border-orange-500/40',
        animation: {
          initial: { opacity: 0, x: -50 },
          animate: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 400, damping: 25 } },
          exit: { opacity: 0, x: 50 },
        },
      };
    case 'bid_overtaken':
      return {
        icon: AlertCircle,
        colorClass: 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]',
        bgClass: 'bg-gradient-to-r from-red-500/20 to-rose-500/20 border-red-500/50',
        animation: {
          initial: { opacity: 0, scale: 1.2 },
          animate: {
            opacity: 1,
            scale: 1,
            x: [0, -10, 10, -10, 10, 0],
            transition: { duration: 0.5 },
          },
          exit: { opacity: 0, scale: 0.8 },
        },
      };
    case 'auction_extending':
      return {
        icon: Clock,
        colorClass: 'text-amber-300',
        bgClass: 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-amber-500/40',
        animation: {
          initial: { opacity: 0, y: 50 },
          animate: { opacity: 1, y: 0, transition: { type: 'spring' } },
          exit: { opacity: 0, y: -50 },
        },
      };
    case 'auction_won':
      return {
        icon: Trophy,
        colorClass: 'text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,1)]',
        bgClass: 'bg-gradient-to-r from-purple-600/30 via-pink-500/30 to-orange-500/30 border-yellow-400/50 shadow-[0_0_30px_rgba(250,204,21,0.3)]',
        animation: {
          initial: { opacity: 0, scale: 0, rotate: -180 },
          animate: { opacity: 1, scale: 1.2, rotate: 0, transition: { type: 'spring', bounce: 0.5, duration: 0.8 } },
          exit: { opacity: 0, scale: 0 },
        },
      };
    case 'auction_lost':
      return {
        icon: XCircle,
        colorClass: 'text-zinc-400',
        bgClass: 'bg-zinc-800/80 border-zinc-600/50',
        animation: {
          initial: { opacity: 0, filter: 'blur(10px)' },
          animate: { opacity: 1, filter: 'blur(0px)' },
          exit: { opacity: 0, filter: 'blur(10px)' },
        },
      };
    case 'bid_success':
    default:
      return {
        icon: CheckCircle2,
        colorClass: 'text-emerald-400',
        bgClass: 'bg-emerald-500/20 border-emerald-500/30',
        animation: {
          initial: { opacity: 0, y: -20 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: -20 },
        },
      };
  }
};

export default function NotificationLayer() {
  const notifications = useNotificationStore((s) => s.notifications);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex flex-col items-center justify-center pt-20 pb-40 gap-4 overflow-hidden">
      <AnimatePresence>
        {notifications.map((n) => {
          const config = getNotificationConfig(n.type);
          const Icon = config.icon;

          return (
            <motion.div
              key={n.id}
              {...config.animation}
              className={`flex items-center gap-3 px-6 py-3.5 rounded-full backdrop-blur-xl border border-t-white/20 shadow-2xl ${config.bgClass}`}
            >
              <div className={`flex items-center justify-center ${config.colorClass}`}>
                {n.type === 'auction_won' ? (
                  <div className="relative">
                    <Sparkles className="absolute -top-2 -right-2 w-4 h-4 text-yellow-200 animate-ping" />
                    <Icon className="w-8 h-8 animate-bounce" />
                  </div>
                ) : (
                  <Icon className="w-6 h-6" />
                )}
              </div>
              <span className="text-white font-black tracking-wide text-[15px] drop-shadow-md">
                {n.message}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
