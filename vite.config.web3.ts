import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-web3',
    rollupOptions: {
      input: 'index-web3.html',
    },
  },
})
