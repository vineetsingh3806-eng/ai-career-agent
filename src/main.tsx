import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Guard against external ClerkJS dev-mode attribution errors tripping the uncaught error overlay
if (typeof window !== 'undefined') {
  window.addEventListener(
    'error',
    (event) => {
      const msg = event.message || event.error?.message || '';
      if (msg.includes('ClerkJS:') || msg.includes('instance running on Clerk')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        console.warn('[Clerk] Suppressed dev instance attribution error:', msg);
      }
    },
    true
  );

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || String(event.reason || '');
    if (reason.includes('ClerkJS:') || reason.includes('instance running on Clerk')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.warn('[Clerk] Suppressed dev instance attribution rejection:', reason);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
