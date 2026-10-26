const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react').default;

module.exports = defineConfig({
  plugins: [react()],
  server: {
    watch: {
      ignored: ['**/data/**'],
    },
    proxy: {
      '/api': 'http://localhost:3001',
      '/healthz': 'http://localhost:3001',
    },
  },
});
