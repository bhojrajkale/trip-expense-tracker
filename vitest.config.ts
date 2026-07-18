import { defineConfig } from 'vitest/config'

// Deliberately separate from vite.config.ts: that file loads VitePWA and
// Tailwind plugins meant for the real app build, which have no business
// running during tests. Keeping this config isolated means test runs can
// never affect (or be affected by) the production build pipeline.
export default defineConfig({
  test: {
    environment: 'node', // everything tested here is plain logic, no DOM
  },
})
