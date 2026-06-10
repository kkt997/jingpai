import { create } from 'zustand';

export type NotificationType =
  | 'bid_success'
  | 'bid_leading'
  | 'bid_overtaken'
  | 'auction_start'
  | 'auction_extending'
  | 'auction_ending'
  | 'auction_won'
  | 'auction_lost';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration: number;
}

interface NotificationState {
  notifications: Notification[];
  push: (n: Omit<Notification, 'id'>) => void;
  remove: (id: string) => void;
}

let nextId = 0;

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  push: (n) => {
    const id = String(++nextId);
    set((state) => ({
      notifications: [...state.notifications, { ...n, id }],
    }));
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter((item) => item.id !== id),
      }));
    }, n.duration);
  },

  remove: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}));
