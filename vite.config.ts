import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// RawRoute のエンドポイントは API サーバー（localhost:3001）が配信する。
// フロント（localhost:3000）から相対パスで叩けるよう proxy する。
// これでブラウザからは同一オリジン扱いになり、セッション Cookie が機能する。
const apiProxy = { target: 'http://localhost:3001', changeOrigin: true };

export default defineConfig({
  plugins: [react()],
  resolve: {
    conditions: ['browser']
  },
  server: {
    port: 3000,
    proxy: {
      '/auth': apiProxy,
      '/tickets': apiProxy,
      '/attachments': apiProxy,
      '/search': apiProxy,
      '/export': apiProxy,
    },
  },
  build: {
    outDir: 'dist'
  }
});
