import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Weather from './pages/Weather';
import Chat from './pages/Chat';
import Alerts from './pages/Alerts';
import Reports from './pages/Reports';
import Market from './pages/Market';
import Services from './pages/Services';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import Pricing from './pages/Pricing';
import Settings from './pages/Settings';
import Maps from './pages/Maps';
import Research from './pages/Research';
import Services from './pages/Services';
import ProtectedRoute from './components/ProtectedRoute';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <Layout />
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
          <Route path="services" element={<Services />} />
          <Route path="market" element={<Market />} />
          <Route path="services" element={<Services />} />
          <Route path="billing" element={<Pricing />} />
          <Route path="settings" element={<Settings />} />
          <Route path="research" element={<Research />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
