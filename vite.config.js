import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// React component entry points — add new apps here as they are created.
// SCSS compilation is handled separately by the Sass CLI (see `build:css` script).
const reactEntries = {
  // Example:
  // 'product-configurator': resolve(__dirname, 'src/react/apps/product-configurator/index.jsx'),
};

const hasReactEntries = Object.keys(reactEntries).length > 0;

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'assets',
    // CRITICAL: never wipe /assets/ — it contains SVGs, fonts, existing CSS, and JS
    emptyOutDir: false,
    // Skip Rollup entirely when no React entries are defined
    ...(hasReactEntries
      ? {
          rollupOptions: {
            input: reactEntries,
            output: {
              entryFileNames: '[name].js',
              chunkFileNames: '[name]-chunk.js',
              assetFileNames: '[name][extname]',
            },
          },
        }
      : {}),
  },
  resolve: {
    alias: {
      '@styles': resolve(__dirname, 'src/styles'),
      '@components': resolve(__dirname, 'src/react'),
    },
  },
});
