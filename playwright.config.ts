import { defineConfig, devices } from '@playwright/test';

/**
 * 默认针对生产构建（vite preview）测试，确保 Worker、WASM 以外的静态资源、类型库与沙箱在构建产物中可用。
 * 开发时可设置 E2E_DEV=1 使用开发服务器（更快）。
 */
const dev = process.env.E2E_DEV === '1';
const port = dev ? 5175 : 4175;

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 2,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'e2e', testDir: './tests/e2e', use: { ...devices['Desktop Chrome'] } },
    { name: 'e2e-webkit', testDir: './tests/e2e', testMatch: /pipeline|security/, use: { ...devices['Desktop Safari'] } },
    { name: 'content', testDir: './tests/content', timeout: 600_000, use: { ...devices['Desktop Chrome'] } },
    // 本地探测（不提交）：PROBE=1 npx playwright test --project=probe
    ...(process.env.PROBE === '1' ? [{ name: 'probe', testDir: './tests/probe', use: { ...devices['Desktop Chrome'] } }] : []),
  ],
  webServer: {
    command: dev ? `npx vite --port ${port} --strictPort` : `npx vite preview --port ${port} --strictPort`,
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
