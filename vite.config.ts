import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
// import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vitejs.dev/config/
export default defineConfig({
  assetsInclude: ['**/*.ttf'],
  base: './',
  plugins: [
    vue(),
    // basicSsl() // Disable in production. Used for localhost HTTPS testing.
  ],
})