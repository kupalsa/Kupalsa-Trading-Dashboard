import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * A stamp identifying this build. In CI the commit SHA is exact; locally the
 * build time is enough to tell two builds apart.
 */
const APP_VERSION = process.env.GITHUB_SHA?.slice(0, 7) ?? `dev-${Date.now()}`

/**
 * Writes the stamp to version.json beside index.html.
 *
 * GitHub Pages serves index.html with `cache-control: max-age=600` and won't
 * let us change that, while the bundle it points at is content-hashed. So a
 * client holding a stale index.html keeps loading the old hashed bundle —
 * which still exists — and never sees a new release. A Safari web app added
 * to the Dock keeps its own cache and can sit on that HTML far longer than
 * ten minutes. The running app therefore has to notice for itself, by asking
 * for this file with caching disabled and comparing it to its own stamp.
 */
function emitVersion(): Plugin {
  return {
    name: 'emit-version',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: APP_VERSION }),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), emitVersion()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  // A fixed, non-fallback port keeps the dev server on the same origin every
  // run — localStorage (day state, selected strategy, theme) is scoped per
  // origin, so a silently different port would look like the app "forgot"
  // everything on the next `npm run dev`. PORT lets a host (e.g. an
  // automation harness running its own preview alongside another one) assign
  // a different fixed port instead; plain `npm run dev` still lands on 5173.
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: true,
  },
})
