import { defineConfig } from 'vite'

export default defineConfig({
  // relatív útvonalak: bármilyen alútvonalon működik (pl. GitHub Pages: /repo-nev/)
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
})
