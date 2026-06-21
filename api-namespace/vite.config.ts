import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// aws-blocks/client.js (auto-generated) side-effect imports these server-only
// subpaths that don't exist as browser modules. Stub them so Vite resolves them.
const stubServerOnlyModules: import('vite').Plugin = {
  name: 'stub-aws-blocks-server-modules',
  resolveId(id) {
    if (
      id === '@aws-blocks/bb-file-bucket/middleware' ||
      id === '@aws-blocks/bb-realtime/mock-middleware'
    ) {
      return '\0virtual:' + id;
    }
  },
  load(id) {
    if (id.startsWith('\0virtual:@aws-blocks/')) return '';
  },
};

export default defineConfig({
  plugins: [react(), stubServerOnlyModules],
  resolve: {
    conditions: ['browser']
  },
  server: {
    port: 3000
  },
  build: {
    outDir: 'dist'
  }
});
