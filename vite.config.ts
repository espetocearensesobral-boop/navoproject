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
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('jspdf') || id.includes('html2canvas')) {
                return 'pdf';
              }
              if (id.includes('lucide-react')) {
                return 'icons';
              }
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                return 'vendor';
              }
            }
          }
        }
      }
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
