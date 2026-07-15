import { lazy, Suspense, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from './lib/api';
import AppLayout from './layout/AppLayout';
import { ErrorBoundary, RouteErrorBoundary } from './components/ErrorBoundary';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Settings = lazy(() => import('./pages/Settings'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Products = lazy(() => import('./pages/Products'));
const CreateOrder = lazy(() => import('./pages/CreateOrder'));
const Reconciliation = lazy(() => import('./pages/Reconciliation'));
const ControlPanel = lazy(() => import('./pages/ControlPanel'));
const Orders = lazy(() => import('./pages/Orders'));
const Analytics = lazy(() => import('./pages/Analytics'));
const CostCalculator = lazy(() => import('./pages/CostCalculator'));

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

// Wrap each lazy page in its own route-scoped boundary, so one crashing page
// shows the fallback in-place (sidebar stays usable) instead of white-screening.
const page = (el: ReactElement) => <RouteErrorBoundary>{el}</RouteErrorBoundary>;

export default function App() {
  return (
    // App-wide net: catches crashes in the layout/providers that a per-route
    // boundary can't (full-screen fallback).
    <ErrorBoundary fullScreen>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={page(<Login />)} />
          <Route path="/register" element={page(<Register />)} />
          <Route path="/accept-invite/:token" element={page(<AcceptInvite />)} />
          <Route path="/forgot-password" element={page(<ForgotPassword />)} />
          <Route path="/reset-password/:token" element={page(<ResetPassword />)} />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={page(<Dashboard />)} />
            <Route path="suppliers" element={page(<Suppliers />)} />
            <Route path="products" element={page(<Products />)} />
            <Route path="create-order" element={page(<CreateOrder />)} />
            <Route path="reconciliation" element={page(<Reconciliation />)} />
            <Route path="control-panel" element={page(<ControlPanel />)} />
            <Route path="orders" element={page(<Orders />)} />
            <Route path="analytics" element={page(<Analytics />)} />
            <Route path="cost-calculator" element={page(<CostCalculator />)} />
            <Route path="settings" element={page(<Settings />)} />
            {/* Profile / Team / Account consolidated into Settings — redirect old links. */}
            <Route path="team" element={<Navigate to="/app/settings?section=members" replace />} />
            <Route path="profile" element={<Navigate to="/app/settings" replace />} />
            <Route path="account" element={<Navigate to="/app/settings" replace />} />
          </Route>
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
