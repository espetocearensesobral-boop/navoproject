import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router') || id.includes('/@remix-run/')) {
                return 'vendor-react';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('framer-motion') || id.includes('/motion/')) {
                return 'vendor-motion';
              }
              if (id.includes('date-fns') || id.includes('react-day-picker')) {
                return 'vendor-date';
              }
              return 'vendor'; // all other node_modules
            }
          },
        },
      },
    },
    server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: process.env.DISABLE_HMR === 'true' ? false : {
      protocol: 'wss',
      clientPort: 443
    },
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  }
  };
});
