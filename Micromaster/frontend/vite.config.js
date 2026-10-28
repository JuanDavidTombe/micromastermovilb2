const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig({
  plugins: [react()],
  server: {
    // Modo dev (npm run dev) sigue usando proxy al puerto 8080
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://api.micromaster.test:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    // El build de producción usa rutas relativas para que Apache haga el proxy
    outDir: 'dist',
  },
});
