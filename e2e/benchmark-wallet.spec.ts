/**
 * Wallet benchmarks: connect MetaMask, run benchmark with includeWalletMetrics.
 * Requires Synpress (Linux): npx synpress, then npx playwright test e2e/benchmark-wallet.spec.ts
 * Results are saved to e2e-results/wallet-{lib}.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { expect } from '@playwright/test'
import { testWithSynpress } from '@synthetixio/synpress'
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright'
import basicSetup from '../test/wallet-setup/basic.setup'

const test = testWithSynpress(metaMaskFixtures(basicSetup))

const RESULTS_DIR = path.join(process.cwd(), 'e2e-results')

const LOCK_SELECTOR = '[data-testid="unlock-password"]'

/**
 * Убеждается, что MetaMask разблокирован. Ищет вкладку с lock-формой (в т.ч. среди
 * всех вкладок context), при необходимости переходит на home, вводит пароль и
 * нажимает «Разблокировать». Повторяет до 2 раз при сбое.
 */
async function ensureMetaMaskUnlocked(
  metamask: InstanceType<typeof MetaMask>,
  extensionId: string
): Promise<void> {
  const password = basicSetup.walletPassword
  const extensionUrl = `chrome-extension://${extensionId}/home.html`
  const maxRetries = 2

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      let targetPage = metamask.page

      const pages = metamask.context.pages()
      for (const p of pages) {
        if (!p.url().startsWith(`chrome-extension://${extensionId}/`)) continue
        const lockVisible = await p.locator(LOCK_SELECTOR).isVisible({ timeout: 500 }).catch(() => false)
        if (lockVisible) {
          targetPage = p
          break
        }
      }

      if (!targetPage.url().startsWith(`chrome-extension://${extensionId}/`)) {
        await targetPage.goto(extensionUrl)
        await new Promise((r) => setTimeout(r, 1500))
      }

      const lockInput = targetPage.locator(LOCK_SELECTOR)
      const isLocked = await lockInput.isVisible({ timeout: 3000 }).catch(() => false)
      console.log('[ensureMetaMaskUnlocked] isLocked:', isLocked, 'targetPage:', targetPage.url())
      if (!isLocked) return

      await lockInput.fill(password)
      await new Promise((r) => setTimeout(r, 800))
      const submitBtn = targetPage.locator('[data-testid="unlock-submit"]')
      await expect(submitBtn).toBeEnabled({ timeout: 5000 })
      await submitBtn.click()
      await new Promise((r) => setTimeout(r, 2000))

      const stillLocked = await lockInput.isVisible({ timeout: 2000 }).catch(() => false)
      if (!stillLocked) return
    } catch {
      // retry
    }
  }
}

function saveResults(type: string, libId: string, results: unknown) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true })
  const file = path.join(RESULTS_DIR, `${type}-${libId}.json`)
  const payload = { runAt: new Date().toISOString(), ...(results as object) }
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf-8')
}

test.describe('Benchmark Wallet (ethers)', () => {
  test('connectWallet and run benchmark with wallet metrics', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    const metamask = new MetaMask(
      context,
      metamaskPage,
      basicSetup.walletPassword,
      extensionId
    )
    await page.goto('/?lib=ethers')
    await page.waitForSelector('text=Adapter: ethers', { timeout: 10000 })
    await ensureMetaMaskUnlocked(metamask, extensionId)
    await page.getByTestId('connect-wallet').click()
    await metamask.connectToDapp()
    await page.getByTestId('benchmark-repeats').fill('1')
    await page.getByTestId('include-wallet').check().catch(() => {})
    await page.getByTestId('run-benchmark').click()
    await page.waitForFunction(
      () =>
        (window as unknown as { __benchmarkResults?: unknown }).__benchmarkResults !=
        null,
      { timeout: 120000 }
    )
    const results = await page.evaluate(
      () =>
        (window as unknown as {
          __benchmarkResults?: { libId: string; connectWalletMs?: number }
        }).__benchmarkResults
    )
    expect(results).toBeDefined()
    if (results) saveResults('wallet', 'ethers', results)
  })
})

test.describe('Benchmark Wallet (viem)', () => {
  test('connectWallet and run benchmark with wallet metrics', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    const metamask = new MetaMask(
      context,
      metamaskPage,
      basicSetup.walletPassword,
      extensionId
    )
    await page.goto('/?lib=viem')
    await page.waitForSelector('text=Adapter: viem', { timeout: 10000 })
    await ensureMetaMaskUnlocked(metamask, extensionId)
    await page.getByTestId('connect-wallet').click()
    await metamask.connectToDapp()
    await page.getByTestId('benchmark-repeats').fill('1')
    await page.getByTestId('include-wallet').check().catch(() => {})
    await page.getByTestId('run-benchmark').click()
    await page.waitForFunction(
      () =>
        (window as unknown as { __benchmarkResults?: unknown }).__benchmarkResults !=
        null,
      { timeout: 120000 }
    )
    const results = await page.evaluate(
      () =>
        (window as unknown as {
          __benchmarkResults?: { libId: string; connectWalletMs?: number }
        }).__benchmarkResults
    )
    expect(results).toBeDefined()
    if (results) saveResults('wallet', 'viem', results)
  })
})
