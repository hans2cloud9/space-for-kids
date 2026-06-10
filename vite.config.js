import { defineConfig } from 'vite'

// GitHub Pages needs /space-for-kids/ base; Vercel and local use /
const base = process.env.GITHUB_ACTIONS ? '/space-for-kids/' : '/'

export default defineConfig({ base })
