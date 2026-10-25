import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_BASE_URL || 'http://localhost:8081';
  const wsTarget = env.VITE_WS_URL ? env.VITE_WS_URL.replace(/^ws/, 'http') : 'http://localhost:8081';

  return {
    server: {
      port: 5173,
      host: '0.0.0.0',
      strictPort: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true
        },
        '/academic': {
          target: apiTarget,
          changeOrigin: true
        },
        '/ws': {
          target: wsTarget,
          ws: true,
          changeOrigin: true
        }
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      assetsDir: 'assets',
      chunkSizeWarningLimit: 5000
    }
  };
});
