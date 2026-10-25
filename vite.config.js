const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react').default;
const tailwindcss = require('@tailwindcss/vite').default;

module.exports = defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      ignored: ['**/data/**'],
    },
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
