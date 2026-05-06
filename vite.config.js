import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/product-bulk-order.jsx'),
      name: 'ProductBulkOrder',
      formats: ['iife'],
      fileName: () => 'product-bulk-order.js',
    },
    outDir: 'assets',
    emptyOutDir: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'product-bulk-order.js',
        assetFileNames: 'product-bulk-order.[ext]',
      },
    },
  },
});
