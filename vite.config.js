    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';
    import path from 'path';
    import { fileURLToPath } from 'url';

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    export default defineConfig({
      root: path.resolve(__dirname, './'),
      plugins: [react()],
      base: '/', 
      build: {
        outDir: 'dist', 
        assetsDir: 'assets', 
      },
    });
    