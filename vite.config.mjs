import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isDocker = env.VITE_DOCKER === '1';
  const mainTarget = env.VITE_MAIN_API_PROXY_TARGET || (isDocker ? 'http://main-server:3000' : 'http://127.0.0.1:3000');
  const chatTarget = env.VITE_CHAT_API_PROXY_TARGET || (isDocker ? 'http://chat-server:3001' : 'http://127.0.0.1:3001');

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: mainTarget,
          changeOrigin: true,
          secure: false
        },
        '/socket.io': {
          target: chatTarget,
          changeOrigin: true,
          ws: true,
          secure: false
        },
        '/chat-api': {
          target: chatTarget,
          changeOrigin: true,
          secure: false
        }
      }
    }
  };
});