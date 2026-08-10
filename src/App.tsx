import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { ConfirmProvider } from './components/ui/useConfirm';
import { captureException } from './services/monitoring';

// Páginas públicas: eagerly loaded (login flow precisa ser instantâneo)
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import LandingPage from './pages/LandingPage';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import CancellationPolicy from './pages/CancellationPolicy';

// Páginas internas: lazy loaded — reduz bundle inicial drasticamente.
// Cada chunk só é baixado quando o usuário navega pra rota correspondente.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Weather = lazy(() => import('./pages/Weather'));
const Chat = lazy(() => import('./pages/Chat'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Reports = lazy(() => import('./pages/Reports'));
const Market = lazy(() => import('./pages/Market'));
const Services = lazy(() => import('./pages/Services'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Settings = lazy(() => import('./pages/Settings'));
const Maps = lazy(() => import('./pages/Maps'));
const SoilData = lazy(() => import('./pages/SoilData'));
const FieldLog = lazy(() => import('./pages/FieldLog'));
const Calculator = lazy(() => import('./pages/Calculator'));
const Seasons = lazy(() => import('./pages/Seasons'));
const Caderno = lazy(() => import('./pages/Caderno'));
const Images = lazy(() => import('./pages/Images'));
const BillingSuccess = lazy(() => import('./pages/BillingResult').then(m => ({ default: m.BillingSuccess })));
const BillingFailed = lazy(() => import('./pages/BillingResult').then(m => ({ default: m.BillingFailed })));
const BillingPending = lazy(() => import('./pages/BillingResult').then(m => ({ default: m.BillingPending })));

// Fallback enquanto chunk lazy carrega
function RouteFallback() {
  return (
    <div className="flex-1 flex items-center justify-center gap-3" style={{ background: 'var(--bg)' }}>
      <div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      <p className="text-sm" style={{ color: 'var(--muted)' }}>Carregando…</p>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary onError={(error, info) => captureException(error, { componentStack: info.componentStack })}>
      <ConfirmProvider>
      <Routes>
        {/* Públicas — não lazy pra UX rápida no login */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/cancellation-policy" element={<CancellationPolicy />} />

        {/* App autenticado — todas lazy */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <Suspense fallback={<RouteFallback />}>
                <Layout />
              </Suspense>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="weather" element={<Weather />} />
          <Route path="chat" element={<Chat />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="reports" element={<Reports />} />
          <Route path="maps" element={<Maps />} />
          <Route path="market" element={<Market />} />
          <Route path="services" element={<Services />} />
          <Route path="billing" element={<Pricing />} />
          <Route path="settings" element={<Settings />} />
          <Route path="soil" element={<SoilData />} />
          <Route path="field-log" element={<FieldLog />} />
          <Route path="calculator" element={<Calculator />} />
          <Route path="seasons" element={<Seasons />} />
          <Route path="caderno" element={<Caderno />} />
          <Route path="images" element={<Images />} />
          {/* Páginas de retorno do checkout Mercado Pago */}
          <Route path="billing/success" element={<BillingSuccess />} />
          <Route path="billing/failed" element={<BillingFailed />} />
          <Route path="billing/pending" element={<BillingPending />} />
        </Route>
      </Routes>
      </ConfirmProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
