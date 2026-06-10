import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import AuctionsPage from './pages/AuctionsPage';
import RoomsPage from './pages/RoomsPage';
import OrdersPage from './pages/OrdersPage';
import LivePanelPage from './pages/LivePanelPage';
import RoomPreviewPage from './pages/RoomPreviewPage';
import ProfilePage from './pages/ProfilePage';
import EarningsPage from './pages/EarningsPage';
import MessagesPage from './pages/MessagesPage';
import ConversationPage from './pages/ConversationPage';
import FollowersPage from './pages/FollowersPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
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
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="auctions" element={<AuctionsPage />} />
        <Route path="rooms" element={<RoomsPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="earnings" element={<EarningsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="messages/:conversationId" element={<ConversationPage />} />
        <Route path="followers" element={<FollowersPage />} />
        <Route path="live-panel" element={<LivePanelPage />} />
        <Route path="room/:roomId" element={<RoomPreviewPage />} />
      </Route>
    </Routes>
  );
}
