/**
 * Wallet Mock benchmarks: connect wallet (cold/warm) and sign+send tx
 * без MetaMask/Synpress. Вместо этого используется @johanneskares/wallet-mock,
 * который реализует EIP‑6963/EIP‑1193 провайдер в браузере.
 *
 * Требования:
 * - Локальный RPC (Anvil/Hardhat) на http://127.0.0.1:8545
 * - Vite dev‑сервер (npm run dev) или webServer из playwright.config.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '@playwright/test'
import { installMockWallet } from '@johanneskares/wallet-mock'
import { privateKeyToAccount } from 'viem/accounts'
import { http } from 'viem'
import { hardhat } from 'viem/chains'
import { computeStats, type TimingStats } from '../src/benchmark/stats'

// Тот же адрес, что и в rpcOperations.ts
const TEST_ADDRESS = '0x0000000000000000000000000000000000000001'

const RESULTS_DIR = path.join(process.cwd(), 'e2e-results')

interface PhaseMetrics {
  timings: number[]
  stats: TimingStats
}

interface WalletMockMetrics {
  repeats: number
  coldConnectMs: number
  warmConnect: PhaseMetrics
  sign: PhaseMetrics
  send: PhaseMetrics
  txHashes: string[]
}

function saveResults(type: string, libId: string, metrics: WalletMockMetrics) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true })
  const file = path.join(RESULTS_DIR, `${type}-${libId}.json`)
  const payload = { runAt: new Date().toISOString(), libId, ...metrics }
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf-8')
}

test.describe('Wallet Mock (ethers)', () => {
  test.beforeEach(async ({ page }) => {
    // Устанавливаем Mock Wallet в браузерный контекст
    await installMockWallet({
      page,
      account: privateKeyToAccount(
        // Стандартный тестовый приватник из Hardhat/Foundry
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      ),
      defaultChain: hardhat,
      transports: {
        [hardhat.id]: http('http://127.0.0.1:8545'),
      },
    })

    // Мост между EIP-6963 и window.ethereum для нашего стенда
    await page.addInitScript(() => {
      type EIP6963ProviderDetail = {
        info: { name: string }
        provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
      }

      const chooseFirstWallet = (detail: EIP6963ProviderDetail) => {
        if (!(window as any).ethereum) {
          ;(window as any).ethereum = detail.provider
        }
      }

      window.addEventListener('eip6963:announceProvider', (event) => {
        const detail = (event as CustomEvent<EIP6963ProviderDetail>).detail
        if (detail?.info?.name === 'Mock Wallet') {
          chooseFirstWallet(detail)
        }
      })

      window.dispatchEvent(new Event('eip6963:requestProvider'))
    })
  })

  test('cold/warm connect, sign and send tx (ethers)', async ({ page }) => {
    await page.goto('/?lib=ethers')
    await page.waitForSelector('text=Adapter: ethers', { timeout: 15_000 })

    const raw = await page.evaluate(async (to) => {
      const eth = (window as any).ethereum as {
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      }
      if (!eth) throw new Error('window.ethereum is not set')

      const repeats = 100
      const warmSamples: number[] = []
      const signSamples: number[] = []
      const sendSamples: number[] = []
      const txHashes: string[] = []

      let coldConnectMs = 0
      let from: string | undefined

      for (let i = 0; i < repeats; i++) {
        const t0 = performance.now()
        const accounts = (await eth.request({
          method: 'eth_requestAccounts',
          params: [],
        })) as string[]
        const dt = performance.now() - t0

        if (i === 0) {
          coldConnectMs = dt
          from = accounts[0]
        } else {
          warmSamples.push(dt)
        }
      }

      if (!from) throw new Error('No accounts from wallet-mock')

      for (let i = 0; i < repeats; i++) {
        const tx = {
          from,
          to,
          value: '0x0',
          data: '0x',
          gas: '0x5208', // 21000
        }

        let t0 = performance.now()
        const signed = (await eth.request({
          method: 'eth_signTransaction',
          params: [tx],
        })) as string
        signSamples.push(performance.now() - t0)

        t0 = performance.now()
        const txHash = (await eth.request({
          method: 'eth_sendRawTransaction',
          params: [signed],
        })) as string
        sendSamples.push(performance.now() - t0)
        txHashes.push(txHash)
      }

      return {
        repeats,
        coldConnectMs,
        warmSamples,
        signSamples,
        sendSamples,
        txHashes,
      }
    }, TEST_ADDRESS)

    const metrics: WalletMockMetrics = {
      repeats: raw.repeats,
      coldConnectMs: raw.coldConnectMs,
      warmConnect: {
        timings: raw.warmSamples,
        stats: computeStats(raw.warmSamples),
      },
      sign: {
        timings: raw.signSamples,
        stats: computeStats(raw.signSamples),
      },
      send: {
        timings: raw.sendSamples,
        stats: computeStats(raw.sendSamples),
      },
      txHashes: raw.txHashes,
    }

    expect(metrics.coldConnectMs).toBeGreaterThan(0)
    expect(metrics.warmConnect.stats.mean).toBeGreaterThan(0)
    expect(metrics.sign.stats.mean).toBeGreaterThan(0)
    expect(metrics.send.stats.mean).toBeGreaterThan(0)
    expect(metrics.repeats).toBe(100)
    expect(metrics.warmConnect.stats.count).toBe(99)
    expect(metrics.sign.stats.count).toBe(100)
    expect(metrics.send.stats.count).toBe(100)
    expect(metrics.txHashes.length).toBe(100)
    expect(metrics.txHashes[0]).toMatch(/^0x[a-fA-F0-9]{64}$/)

    saveResults('wallet-mock', 'ethers', metrics)
  })
})

test.describe('Wallet Mock (viem)', () => {
  test.beforeEach(async ({ page }) => {
    await installMockWallet({
      page,
      account: privateKeyToAccount(
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      ),
      defaultChain: hardhat,
      transports: {
        [hardhat.id]: http('http://127.0.0.1:8545'),
      },
    })

    await page.addInitScript(() => {
      type EIP6963ProviderDetail = {
        info: { name: string }
        provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
      }

      const chooseFirstWallet = (detail: EIP6963ProviderDetail) => {
        if (!(window as any).ethereum) {
          ;(window as any).ethereum = detail.provider
        }
      }

      window.addEventListener('eip6963:announceProvider', (event) => {
        const detail = (event as CustomEvent<EIP6963ProviderDetail>).detail
        if (detail?.info?.name === 'Mock Wallet') {
          chooseFirstWallet(detail)
        }
      })

      window.dispatchEvent(new Event('eip6963:requestProvider'))
    })
  })

  test('cold/warm connect, sign and send tx (viem)', async ({ page }) => {
    await page.goto('/?lib=viem')
    await page.waitForSelector('text=Adapter: viem', { timeout: 15_000 })

    const raw = await page.evaluate(async (to) => {
      const eth = (window as any).ethereum as {
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      }
      if (!eth) throw new Error('window.ethereum is not set')

      const repeats = 100
      const warmSamples: number[] = []
      const signSamples: number[] = []
      const sendSamples: number[] = []
      const txHashes: string[] = []

      let coldConnectMs = 0
      let from: string | undefined

      for (let i = 0; i < repeats; i++) {
        const t0 = performance.now()
        const accounts = (await eth.request({
          method: 'eth_requestAccounts',
          params: [],
        })) as string[]
        const dt = performance.now() - t0

        if (i === 0) {
          coldConnectMs = dt
          from = accounts[0]
        } else {
          warmSamples.push(dt)
        }
      }

      if (!from) throw new Error('No accounts from wallet-mock')

      for (let i = 0; i < repeats; i++) {
        const tx = {
          from,
          to,
          value: '0x0',
          data: '0x',
          gas: '0x5208',
        }

        let t0 = performance.now()
        const signed = (await eth.request({
          method: 'eth_signTransaction',
          params: [tx],
        })) as string
        signSamples.push(performance.now() - t0)

        t0 = performance.now()
        const txHash = (await eth.request({
          method: 'eth_sendRawTransaction',
          params: [signed],
        })) as string
        sendSamples.push(performance.now() - t0)
        txHashes.push(txHash)
      }

      return {
        repeats,
        coldConnectMs,
        warmSamples,
        signSamples,
        sendSamples,
        txHashes,
      }
    }, TEST_ADDRESS)

    const metrics: WalletMockMetrics = {
      repeats: raw.repeats,
      coldConnectMs: raw.coldConnectMs,
      warmConnect: {
        timings: raw.warmSamples,
        stats: computeStats(raw.warmSamples),
      },
      sign: {
        timings: raw.signSamples,
        stats: computeStats(raw.signSamples),
      },
      send: {
        timings: raw.sendSamples,
        stats: computeStats(raw.sendSamples),
      },
      txHashes: raw.txHashes,
    }

    expect(metrics.coldConnectMs).toBeGreaterThan(0)
    expect(metrics.warmConnect.stats.mean).toBeGreaterThan(0)
    expect(metrics.sign.stats.mean).toBeGreaterThan(0)
    expect(metrics.send.stats.mean).toBeGreaterThan(0)
    expect(metrics.repeats).toBe(100)
    expect(metrics.warmConnect.stats.count).toBe(99)
    expect(metrics.sign.stats.count).toBe(100)
    expect(metrics.send.stats.count).toBe(100)
    expect(metrics.txHashes.length).toBe(100)
    expect(metrics.txHashes[0]).toMatch(/^0x[a-fA-F0-9]{64}$/)

    saveResults('wallet-mock', 'viem', metrics)
  })
})

test.describe('Wallet Mock (web3)', () => {
  test.beforeEach(async ({ page }) => {
    await installMockWallet({
      page,
      account: privateKeyToAccount(
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      ),
      defaultChain: hardhat,
      transports: {
        [hardhat.id]: http('http://127.0.0.1:8545'),
      },
    })

    await page.addInitScript(() => {
      type EIP6963ProviderDetail = {
        info: { name: string }
        provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
      }

      const chooseFirstWallet = (detail: EIP6963ProviderDetail) => {
        if (!(window as any).ethereum) {
          ;(window as any).ethereum = detail.provider
        }
      }

      window.addEventListener('eip6963:announceProvider', (event) => {
        const detail = (event as CustomEvent<EIP6963ProviderDetail>).detail
        if (detail?.info?.name === 'Mock Wallet') {
          chooseFirstWallet(detail)
        }
      })

      window.dispatchEvent(new Event('eip6963:requestProvider'))
    })
  })

  test('cold/warm connect, sign and send tx (web3)', async ({ page }) => {
    await page.goto('/?lib=web3')
    await page.waitForSelector('text=Adapter: web3', { timeout: 15_000 })

    const raw = await page.evaluate(async (to) => {
      const eth = (window as any).ethereum as {
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      }
      if (!eth) throw new Error('window.ethereum is not set')

      const repeats = 100
      const warmSamples: number[] = []
      const signSamples: number[] = []
      const sendSamples: number[] = []
      const txHashes: string[] = []

      let coldConnectMs = 0
      let from: string | undefined

      for (let i = 0; i < repeats; i++) {
        const t0 = performance.now()
        const accounts = (await eth.request({
          method: 'eth_requestAccounts',
          params: [],
        })) as string[]
        const dt = performance.now() - t0

        if (i === 0) {
          coldConnectMs = dt
          from = accounts[0]
        } else {
          warmSamples.push(dt)
        }
      }

      if (!from) throw new Error('No accounts from wallet-mock')

      for (let i = 0; i < repeats; i++) {
        const tx = {
          from,
          to,
          value: '0x0',
          data: '0x',
          gas: '0x5208',
        }

        let t0 = performance.now()
        const signed = (await eth.request({
          method: 'eth_signTransaction',
          params: [tx],
        })) as string
        signSamples.push(performance.now() - t0)

        t0 = performance.now()
        const txHash = (await eth.request({
          method: 'eth_sendRawTransaction',
          params: [signed],
        })) as string
        sendSamples.push(performance.now() - t0)
        txHashes.push(txHash)
      }

      return {
        repeats,
        coldConnectMs,
        warmSamples,
        signSamples,
        sendSamples,
        txHashes,
      }
    }, TEST_ADDRESS)

    const metrics: WalletMockMetrics = {
      repeats: raw.repeats,
      coldConnectMs: raw.coldConnectMs,
      warmConnect: {
        timings: raw.warmSamples,
        stats: computeStats(raw.warmSamples),
      },
      sign: {
        timings: raw.signSamples,
        stats: computeStats(raw.signSamples),
      },
      send: {
        timings: raw.sendSamples,
        stats: computeStats(raw.sendSamples),
      },
      txHashes: raw.txHashes,
    }

    expect(metrics.coldConnectMs).toBeGreaterThan(0)
    expect(metrics.warmConnect.stats.mean).toBeGreaterThan(0)
    expect(metrics.sign.stats.mean).toBeGreaterThan(0)
    expect(metrics.send.stats.mean).toBeGreaterThan(0)
    expect(metrics.repeats).toBe(100)
    expect(metrics.warmConnect.stats.count).toBe(99)
    expect(metrics.sign.stats.count).toBe(100)
    expect(metrics.send.stats.count).toBe(100)
    expect(metrics.txHashes.length).toBe(100)
    expect(metrics.txHashes[0]).toMatch(/^0x[a-fA-F0-9]{64}$/)

    saveResults('wallet-mock', 'web3', metrics)
  })
})

