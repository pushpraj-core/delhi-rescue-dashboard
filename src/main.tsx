import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './i18n'

import { GoogleOAuthProvider } from '@react-oauth/google';

// Fallback to a placeholder if the env var is missing during development
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '1024881864946-egcokl5t9tlt37duqpl3j27pfdvvr6bv.apps.googleusercontent.com';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)
