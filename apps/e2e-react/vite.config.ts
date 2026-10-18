import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// One React copy for the app and @pip-it-up/react (a linked workspace package with its own
// node_modules would otherwise bring a second one and break hooks).
export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'] },
});
