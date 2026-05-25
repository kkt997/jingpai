import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import LoginPage from './pages/LoginPage';
import RoomListPage from './pages/RoomListPage';
import AuctionRoomPage from './pages/AuctionRoomPage';
import MyBidsPage from './pages/MyBidsPage';
import OrdersPage from './pages/OrdersPage';
import OrderPage from './pages/OrderPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RoomListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/room/:roomId"
        element={
          <ProtectedRoute>
            <AuctionRoomPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-bids"
        element={
          <ProtectedRoute>
            <MyBidsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders"
        element={
          <ProtectedRoute>
            <OrdersPage />
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
    </Routes>
  );
}
