import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { supabase } from './services/supabase'

// Detectar sessão OAuth do URL hash ao iniciar
supabase.auth.onAuthStateChange((_event, _session) => {
  // auth state tracked internally by Supabase
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
