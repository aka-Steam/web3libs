/**
 * Wallet benchmarks: connect MetaMask, run benchmark with includeWalletMetrics, round-trip.
 * Requires Synpress (Linux): npx synpress, then npx playwright test e2e/benchmark-wallet.spec.ts
 * Results are saved to e2e-results/wallet-{lib}.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '@playwright/test'

const RESULTS_DIR = path.join(process.cwd(), 'e2e-results')

function saveResults(type: string, libId: string, results: unknown) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true })
  const file = path.join(RESULTS_DIR, `${type}-${libId}.json`)
  const payload = { runAt: new Date().toISOString(), ...(results as object) }
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf-8')
}

test.describe('Benchmark Wallet (ethers)', () => {
  test.describe.configure({ timeout: 120000 })
  test('connectWallet and run benchmark with wallet metrics', async ({ page }) => {
    await page.goto('/?lib=ethers')
    await page.waitForSelector('text=Adapter: ethers', { timeout: 10000 })
    await page.getByTestId('include-wallet').check().catch(() => {})
    await page.getByTestId('run-benchmark').click()
    await page.waitForFunction(() => (window as unknown as { __benchmarkResults?: unknown }).__benchmarkResults != null, { timeout: 120000 })
    const results = await page.evaluate(() => (window as unknown as { __benchmarkResults?: { libId: string; connectWalletMs?: number } }).__benchmarkResults)
    expect(results).toBeDefined()
    if (results) saveResults('wallet', 'ethers', results)
  })
})

test.describe('Benchmark Wallet (viem)', () => {
  test.describe.configure({ timeout: 120000 })
  test('connectWallet and run benchmark with wallet metrics', async ({ page }) => {
    await page.goto('/?lib=viem')
    await page.waitForSelector('text=Adapter: viem', { timeout: 10000 })
    await page.getByTestId('include-wallet').check().catch(() => {})
    await page.getByTestId('run-benchmark').click()
    await page.waitForFunction(() => (window as unknown as { __benchmarkResults?: unknown }).__benchmarkResults != null, { timeout: 120000 })
    const results = await page.evaluate(() => (window as unknown as { __benchmarkResults?: { libId: string; connectWalletMs?: number } }).__benchmarkResults)
    expect(results).toBeDefined()
    if (results) saveResults('wallet', 'viem', results)
  })
})
