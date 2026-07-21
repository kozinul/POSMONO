/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig(({ mode }) => {
  const plugins = [react()];

  if (mode === 'production') {
    plugins.push(
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [],
        manifest: {
          name: 'POSMono',
          short_name: 'POSMono',
          description: 'Modular Business Operating System',
          theme_color: '#2176D2',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [],
        },
      }),
    );
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared': path.resolve(__dirname, '../shared/src'),
      },
    },
    server: {
      host: true,
      port: 5173,
      fs: {
        allow: [
          __dirname,
          path.resolve(__dirname, '../shared'),
        ],
      },
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'http://localhost:3000',
          ws: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    },
  };
});
