import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import Landing from './Landing.tsx'
// The ERC-5564/6538 lookup motor (App.tsx) is being migrated to the Bauta SDK.
// Its route is intentionally gated below; keep the import commented so the code
// stays in the tree for the migration without tripping noUnusedLocals.
// import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        {/* /lookup disabled during the Bauta SDK migration — the catch-all below
            sends any visitor (including a hand-typed /lookup) back to /. */}
        {/* <Route path="/lookup" element={<App />} /> */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    <Analytics />
  </StrictMode>,
)
