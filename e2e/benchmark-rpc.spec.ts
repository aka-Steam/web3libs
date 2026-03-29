/**
 * RPC-only benchmarks: no MetaMask popup. Run benchmark and collect window.__benchmarkResults.
 * Usage: start app (npm run dev), start Anvil, then npx playwright test e2e/benchmark-rpc.spec.ts
 * Results are saved to e2e-results/rpc-{lib}.json
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

test.describe('Benchmark RPC (ethers)', () => {
  test('run benchmark and collect results', async ({ page }) => {
    await page.goto('/?lib=ethers')
    await page.waitForSelector('text=Adapter: ethers', { timeout: 10000 })
    await page.getByTestId('run-benchmark').click()
    await page.waitForFunction(() => (window as unknown as { __benchmarkResults?: unknown }).__benchmarkResults != null, { timeout: 120000 })
    const results = await page.evaluate(() => (window as unknown as { __benchmarkResults?: { libId: string; operations: unknown[] } }).__benchmarkResults)
    expect(results?.libId).toBe('ethers')
    expect(results?.operations?.length).toBeGreaterThan(0)
    if (results) saveResults('rpc', 'ethers', results)
  })
})

test.describe('Benchmark RPC (viem)', () => {
  test('run benchmark and collect results', async ({ page }) => {
    await page.goto('/?lib=viem')
    await page.waitForSelector('text=Adapter: viem', { timeout: 10000 })
    await page.getByTestId('run-benchmark').click()
    await page.waitForFunction(() => (window as unknown as { __benchmarkResults?: unknown }).__benchmarkResults != null, { timeout: 120000 })
    const results = await page.evaluate(() => (window as unknown as { __benchmarkResults?: { libId: string; operations: unknown[] } }).__benchmarkResults)
    expect(results?.libId).toBe('viem')
    expect(results?.operations?.length).toBeGreaterThan(0)
    if (results) saveResults('rpc', 'viem', results)
  })
})

test.describe('Benchmark RPC (web3)', () => {
  test('run benchmark and collect results', async ({ page }) => {
    await page.goto('/?lib=web3')
    await page.waitForSelector('text=Adapter: web3', { timeout: 10000 })
    await page.getByTestId('run-benchmark').click()
    await page.waitForFunction(() => (window as unknown as { __benchmarkResults?: unknown }).__benchmarkResults != null, { timeout: 120000 })
    const results = await page.evaluate(() => (window as unknown as { __benchmarkResults?: { libId: string; operations: unknown[] } }).__benchmarkResults)
    expect(results?.libId).toBe('web3')
    expect(results?.operations?.length).toBeGreaterThan(0)
    if (results) saveResults('rpc', 'web3', results)
  })
})
