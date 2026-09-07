import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 8732,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8731',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:8731',
        changeOrigin: true,
        ws: true,
      },
      '/uploads': {
        target: 'http://localhost:8731',
        changeOrigin: true,
      },
    },
  },
})
