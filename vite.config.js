import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/Proyecto-Inventario-/',
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Desarrollo: redirige /api al backend local (ajusta el puerto si hace falta)
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
