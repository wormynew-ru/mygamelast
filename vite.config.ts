import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      ignored: ['**/*.rar', '**/*.zip', '**/*.7z'],
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
})
