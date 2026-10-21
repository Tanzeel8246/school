import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],

    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/modules/auth/**',
        'src/modules/students/**',
        'src/modules/fees/**',
        'src/modules/exams/**',
        'src/modules/attendance/**',
        'src/modules/academics/**',
        'src/modules/accounting/**',
        'src/utils/**',
      ],
      exclude: ['**/*.d.ts', '**/node_modules/**'],
    },
  },
  resolve: {
    alias: {
      '@bull-board/api/bullMQAdapter.js': path.resolve(__dirname, 'node_modules/@bull-board/api/bullMQAdapter.js'),
      '@bull-board/api/bullMQAdapter': path.resolve(__dirname, 'node_modules/@bull-board/api/bullMQAdapter.js'),
    },
  },
});
