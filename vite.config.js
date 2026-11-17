import {defineConfig} from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  publicDir: false,
  build: {
    manifest: 'manifest.json',
    outDir: 'public/build',
    emptyOutDir: true,
    rollupOptions: {input: 'resources/js/main.js'}
  }
});
