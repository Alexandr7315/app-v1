import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Туннель (ngrok, cloudflared тощо) — інакше Vite відхиляє чужий Host
    allowedHosts: true,
    proxy: {
      "/api": "http://localhost:4000",
      "/images": "http://localhost:4000",
    },
  },
})
