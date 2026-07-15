import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from './lib/api';
import AppLayout from './layout/AppLayout';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Team = lazy(() => import('./pages/Team'));
const Profile = lazy(() => import('./pages/Profile'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Products = lazy(() => import('./pages/Products'));
const CreateOrder = lazy(() => import('./pages/CreateOrder'));
const Reconciliation = lazy(() => import('./pages/Reconciliation'));
const ControlPanel = lazy(() => import('./pages/ControlPanel'));
const Orders = lazy(() => import('./pages/Orders'));
const Analytics = lazy(() => import('./pages/Analytics'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    // A 401 here just means "not logged in" — handle it via the redirect below,
    // not the global error toast.
    queryFn: () => api.get<{ id: string; email: string; role: string }>('/auth/me', { silent: true }),
    retry: false,
  });
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg">
        <div className="text-app-accent">{t('common.loading')}</div>
      </div>
    );
  }
  if (!data?.data) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PageFallback() {
  const { t } = useTranslation();
  return (
    <div className="min-h-[200px] flex items-center justify-center">
      <div className="text-app-secondary">{t('common.loading')}</div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/accept-invite/:token" element={<AcceptInvite />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="products" element={<Products />} />
          <Route path="create-order" element={<CreateOrder />} />
          <Route path="reconciliation" element={<Reconciliation />} />
          <Route path="control-panel" element={<ControlPanel />} />
          <Route path="orders" element={<Orders />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="team" element={<Team />} />
          <Route path="profile" element={<Profile />} />
          {/* Account merged into Profile — redirect old links. */}
          <Route path="account" element={<Navigate to="/app/profile" replace />} />
        </Route>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </Suspense>
  );
}
