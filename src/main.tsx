import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/lib/auth-context'
import { BranchProvider } from '@/lib/branch-context'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <BranchProvider>
          <App />
          <Toaster
            position="top-left"
            toastOptions={{
              style: {
                background: 'var(--ps-card)',
                border: '1px solid var(--ps-border)',
                color: 'var(--ps-text)',
              },
            }}
          />
        </BranchProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
