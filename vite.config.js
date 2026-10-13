import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [vue({
    template: {
      compilerOptions: {
        isCustomElement: tag => tag === 'emoji-picker'
      }
    }
  })],
  appType: 'spa',
  server: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: isSsrBuild ? {} : {
      output: {
        manualChunks(id) {
          if (id.replaceAll('\\', '/').includes('/node_modules/xlsx/')) {
            return 'excel';
          }
          // Keep dependencies used only by the admin in its lazy import graph.
          if (/\/node_modules\/(?:@vue\/|vue\/)/.test(id.replaceAll('\\', '/'))) return 'vue';
        }
      }
    }
  }
}))
