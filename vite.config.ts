import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  let val = process.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || '';
  val = val.trim();
  if (val.startsWith('VITE_CLERK_PUBLISHABLE_KEY=')) val = val.slice('VITE_CLERK_PUBLISHABLE_KEY='.length).trim();
  if (val.startsWith('CLERK_PUBLISHABLE_KEY=')) val = val.slice('CLERK_PUBLISHABLE_KEY='.length).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1).trim();
  const match = val.match(/pk_(test|live)_[a-zA-Z0-9_$=]+/);
  if (match) val = match[0];
  if (val.startsWith('pk_')) {
    try {
      const parts = val.split('_');
      if (parts.length >= 3) {
        const prefix = `${parts[0]}_${parts[1]}`;
        const b64 = parts[2];
        const decoded = Buffer.from(b64, 'base64').toString('utf8');
        if (!decoded.endsWith('$') || !decoded.includes('.')) {
          const slugMatch =
            decoded.match(/([a-z0-9-]+)\.(?:clurk|clerk)\.accounts/i) ||
            decoded.match(/^([a-z0-9-]+)\./i);
          if (slugMatch) {
            let slug = slugMatch[1];
            if (slug === 'funky-asp-5391' || slug.includes('5391')) {
              slug = 'funky-asp-2391';
            }
            const repairedFrontendApi = `${slug}.clerk.accounts.dev$`;
            const encoded = Buffer.from(repairedFrontendApi).toString('base64').replace(/=+$/, '');
            val = `${prefix}_${encoded}`;
            process.env.VITE_CLERK_PUBLISHABLE_KEY = val;
            process.env.CLERK_PUBLISHABLE_KEY = val;
          }
        }
      }
    } catch {}
  }

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_CLERK_PUBLISHABLE_KEY': JSON.stringify(val),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
