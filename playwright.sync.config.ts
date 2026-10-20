import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * 跨设备同步的端到端测试：开发服务器（含本地 /api）+ 独立的测试密码与临时数据文件。
 * 运行：npx playwright test -c playwright.sync.config.ts
 */
export const SYNC_TEST_PASSWORD = 'tsw-TEST0-PASSW-ORD12-34567-89ABC';
const port = 5176;
const dataFile = path.join(os.tmpdir(), `tsw-sync-e2e-${process.pid}.json`);

export default defineConfig({
  testDir: './tests/sync',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${port}`, ...devices['Desktop Chrome'] },
  webServer: {
    command: `npx vite --port ${port} --strictPort`,
    port,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      SYNC_PASSWORD_HASH: crypto.createHash('sha256').update(SYNC_TEST_PASSWORD).digest('hex'),
      TSW_SYNC_FILE: dataFile,
    },
  },
});
