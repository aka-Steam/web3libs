import raw from './featureFlags.json'

function readAllowWalletBenchmarkUi(): boolean {
  const v = (raw as { allowWalletBenchmarkUi?: boolean }).allowWalletBenchmarkUi
  return v !== false
}

export type AdapterFeatureFlags = {
  /** ethers.js через JsonRpcProvider / getBalance / getFeeData (документация). */
  ethers: boolean
  /** ethers.js с тонким JSON-RPC (сравнение 1:1 с viem/web3). */
  ethersRpc: boolean
  viem: boolean
  web3: boolean
}

export type FeatureFlags = {
  adapters: AdapterFeatureFlags
  /** Панель негативных сценариев (неверный RPC, смена сети в кошельке). */
  negativeTestsPanel: boolean
  /**
   * Если false — скрыть чекбокс метрик кошелька и кнопку подключения;
   * операции только через RPC (метрики кошелька из UI недоступны).
   */
  allowWalletBenchmarkUi: boolean
  /** Верхний предел числа повторений (Repeats) в интерфейсе и при запуске. */
  maxRepeats: number
}

function readAdapterFlags(): AdapterFeatureFlags {
  const a = (raw as { adapters?: Partial<AdapterFeatureFlags> }).adapters ?? {}
  return {
    ethers: a.ethers !== false,
    ethersRpc: a.ethersRpc === true,
    viem: a.viem !== false,
    web3: a.web3 !== false,
  }
}

export const featureFlags: FeatureFlags = {
  adapters: readAdapterFlags(),
  negativeTestsPanel: raw.negativeTestsPanel,
  allowWalletBenchmarkUi: readAllowWalletBenchmarkUi(),
  maxRepeats: (() => {
    const mr = (raw as { maxRepeats?: unknown }).maxRepeats
    const n = typeof mr === 'number' ? mr : Number(mr)
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 100
  })(),
}

/** Clamp repeats to [1, maxRepeats] for UI and runner. */
export function clampRepeats(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  const n = Number.isFinite(parsed) ? Math.floor(parsed) : 1
  const max = featureFlags.maxRepeats
  return Math.min(Math.max(1, n), max)
}
