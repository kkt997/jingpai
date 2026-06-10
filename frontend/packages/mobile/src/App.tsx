import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import LoginPage from './pages/LoginPage';
import TabLayout from './components/TabLayout';
import RoomListPage from './pages/RoomListPage';
import MyBidsPage from './pages/MyBidsPage';
import OrdersPage from './pages/OrdersPage';
import ProfilePage from './pages/ProfilePage';
import AuctionRoomPage from './pages/AuctionRoomPage';
import OrderPage from './pages/OrderPage';
import MessagesPage from './pages/MessagesPage';
import ConversationPage from './pages/ConversationPage';
import UserProfilePage from './pages/UserProfilePage';
import MerchantProfilePage from './pages/MerchantProfilePage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Tab pages — shared bottom nav */}
      <Route
        element={
          <ProtectedRoute>
            <TabLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<RoomListPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="my-bids" element={<MyBidsPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* Sub pages — no bottom nav */}
      <Route
        path="/room/:roomId"
        element={
          <ProtectedRoute>
            <AuctionRoomPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/order/:orderId"
        element={
          <ProtectedRoute>
            <OrderPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/messages/:conversationId"
        element={
          <ProtectedRoute>
            <ConversationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users/:id"
        element={
          <ProtectedRoute>
            <UserProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/merchants/:id"
        element={
          <ProtectedRoute>
            <MerchantProfilePage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
