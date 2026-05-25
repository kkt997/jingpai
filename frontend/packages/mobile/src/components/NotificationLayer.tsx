import { AnimatePresence, motion } from 'framer-motion';
import { useNotificationStore, NotificationType } from '../stores/notificationStore';

const styleMap: Record<NotificationType, string> = {
  bid_success: 'bg-green-500/90 text-white',
  bid_leading: 'bg-green-500/90 text-white',
  bid_overtaken: 'bg-red-500/90 text-white',
  auction_extending: 'bg-yellow-500/90 text-black',
  auction_ending: 'bg-red-600/90 text-white',
  auction_won: 'bg-purple-500/90 text-white',
  auction_lost: 'bg-gray-600/90 text-white',
};

export default function NotificationLayer() {
  const notifications = useNotificationStore((s) => s.notifications);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex flex-col items-center pt-20 gap-2">
      <AnimatePresence>
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: -40, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.8 }}
            className={`px-5 py-2.5 rounded-full text-sm font-bold shadow-xl ${styleMap[n.type] || 'bg-gray-700 text-white'}`}
          >
            {n.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
