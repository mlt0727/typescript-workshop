import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/compiler/**/*.test.ts', 'src/shared/**/*.test.ts', 'server/**/*.test.ts', 'scripts/**/*.test.ts', 'sandbox/src/**/*.node.test.ts', 'src/storage/**/*.node.test.ts'],
          testTimeout: 30000,
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx', 'src/**/*.dom.test.ts', 'sandbox/src/**/*.dom.test.ts'],
          setupFiles: ['./src/test/setup.ts'],
        },
      },
    ],
  },
});
