import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  // A fixed, non-fallback port keeps the dev server on the same origin every
  // run — localStorage (day state, selected strategy, theme) is scoped per
  // origin, so a silently different port would look like the app "forgot"
  // everything on the next `npm run dev`.
  server: {
    port: 5173,
    strictPort: true,
  },
})
