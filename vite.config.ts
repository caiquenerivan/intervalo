import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// BASE_PATH permite publicar numa subpasta (ex.: /intervalo/ no GitHub Pages).
// Sem ela o app fica na raiz, como na Vercel.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
})
