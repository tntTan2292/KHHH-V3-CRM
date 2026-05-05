import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  cacheDir: '.vite_new',
  server: {
    host: '0.0.0.0',
    port: 5181,
    strictPort: true
  }
})
