import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // DOCKER: Khi chạy trong container, dùng tên service "backend" thay vì "localhost"
      // LOCAL:  Khi chạy ngoài Docker, đặt VITE_BACKEND_HOST=localhost trong .env
      '/api': `http://${process.env.VITE_BACKEND_HOST || 'backend'}:3000`,
      '/uploads': `http://${process.env.VITE_BACKEND_HOST || 'backend'}:3000`,
      '/ws': {
        target: `ws://${process.env.VITE_BACKEND_HOST || 'backend'}:3000`,
        ws: true,
        rewriteWsOrigin: true,
      }
    }
  }
})
