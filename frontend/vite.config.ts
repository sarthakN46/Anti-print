import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync } from 'fs'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  server: {
    allowedHosts: true,
    host: '0.0.0.0', // Allow access from Docker
  },
  plugins: [react()],
  // In Docker build, parent .env doesn't exist — fall back to current dir or process.env
  envDir: existsSync(resolve(__dirname, '../.env')) ? '../' : './',
})
