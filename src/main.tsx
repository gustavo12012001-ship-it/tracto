import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { supabase } from './services/supabase'
import { initMonitoring, captureException } from './services/monitoring'

// (A-10) Inicializa observabilidade (no-op se VITE_SENTRY_DSN ausente).
void initMonitoring()

// (A-05/A-10) Erros assíncronos não passam pelo ErrorBoundary do React.
// Capturamos via listeners globais para não perder esses eventos.
window.addEventListener('error', (e) => captureException(e.error ?? e.message))
window.addEventListener('unhandledrejection', (e) => captureException(e.reason))

// Detectar sessão OAuth do URL hash ao iniciar
supabase.auth.onAuthStateChange((_event, _session) => {
  // auth state tracked internally by Supabase
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
