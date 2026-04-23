import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // SSE stream — needs special buffering config
      '/api/logs/stream': {
        target:      'http://localhost:5000',
        changeOrigin: true,
        // Suppress ECONNREFUSED noise during backend startup
        configure: (proxy) => {
          proxy.on('error', () => { /* swallow startup race errors */ });
        }
      },
      // All other API calls
      '/api': {
        target:      'http://localhost:5000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', () => { /* swallow startup race errors */ });
        }
      }
    }
  }
});
