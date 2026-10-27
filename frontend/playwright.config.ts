import { defineConfig, devices } from '@playwright/test'

// Backend: set DOMINO_PYTHON to the interpreter that has the backend dependencies installed (default: python).
const py = process.env.DOMINO_PYTHON ?? 'python'
export default defineConfig({
  testDir: './e2e/tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure', ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
  webServer: [
    { command: `${py} -m uvicorn app.main:app --port 8000`, cwd: '../backend', url: 'http://127.0.0.1:8000/v1/health', reuseExistingServer: true, timeout: 60_000 },
    { command: 'npm run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 60_000 },
  ],
})
