import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, the client talks to the local server via these proxied
// paths so the browser only ever needs one origin. In production, point
// VITE_SERVER_URL at your deployed backend instead (see README).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true
      }
    }
  }
});
