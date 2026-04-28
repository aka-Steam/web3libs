import type { Web3Adapter } from '../adapters/types'
import { computeStats, type TimingStats } from './stats'
import { type RpcOperation, RPC_OPERATIONS, WALLET_OPERATIONS_INJECTED, WALLET_OPERATIONS_MOCK } from './rpcOperations'

declare global {
  interface Window {
    __benchmarkResults?: BenchmarkResultSet
  }
}

export interface OperationResult {
  operationId: string
  name: string
  timings: number[]
  stats: TimingStats
  error?: string
}

export interface WalletProviderDiagnostics {
  hasEthereum: boolean
  isMetaMask?: boolean
  providerKeys?: string[]
  requestedMode?: 'rpc' | 'wallet-mock' | 'injected-wallet'
}

export interface BenchmarkResultSet {
  libId: string
  timestamp: number
  coldStartMs?: number
  hotStartMs?: number
  connectWalletMs?: number
  operations: OperationResult[]
  error?: string
  walletProvider?: WalletProviderDiagnostics
}

export interface RunBenchmarkOptions {
  repeats?: number
  /**
   * If true, benchmark only wallet-related operations (wallet-*.json).
   * If false/omitted, benchmark only public RPC operations (rpc-*.json).
   */
  includeWalletMetrics?: boolean
  walletMode?: 'mock' | 'injected'
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object') {
    const asRecord = error as Record<string, unknown>
    const message = typeof asRecord.message === 'string' ? asRecord.message : undefined
    const code = asRecord.code
    const data = asRecord.data

    if (message) {
      const details: string[] = []
      if (code !== undefined) details.push(`code=${String(code)}`)
      if (data !== undefined) details.push(`data=${safeJson(data)}`)
      return details.length > 0 ? `${message} (${details.join(', ')})` : message
    }

    return safeJson(asRecord)
  }

  return String(error)
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * Run async function `repeats` times, return array of latencies in ms (per iteration).
 */
export async function runAndMeasure(fn: () => Promise<void>, repeats: number): Promise<number[]> {
  const timings: number[] = []
  for (let i = 0; i < repeats; i++) {
    const start = performance.now()
    await fn()
    timings.push(performance.now() - start)
  }
  return timings
}

/**
 * Замер операции: если у операции есть `runSetup`, он выполняется перед каждой итерацией
 * без таймера; в замер попадает только `run`.
 */
async function measureOperationTimings(
  op: RpcOperation,
  adapter: Web3Adapter,
  repeats: number
): Promise<number[]> {
  if (op.runSetup) {
    const timings: number[] = []
    for (let i = 0; i < repeats; i++) {
      await op.runSetup(adapter)
      const start = performance.now()
      await op.run(adapter)
      timings.push(performance.now() - start)
    }
    return timings
  }
  return runAndMeasure(() => op.run(adapter), repeats)
}

/**
 * Run full benchmark: all RPC operations + optional cold/hot start and connectWallet.
 * Results are written to window.__benchmarkResults for E2E to read.
 */
export async function runBenchmark(
  adapter: Web3Adapter,
  options: RunBenchmarkOptions = {}
): Promise<BenchmarkResultSet> {
  const { repeats = 100, includeWalletMetrics = false, walletMode = 'mock' } = options
  const libId = adapter.libId
  const results: OperationResult[] = []
  let coldStartMs: number | undefined
  let hotStartMs: number | undefined
  let connectWalletMs: number | undefined
  let error: string | undefined
  const operationErrors: string[] = []
  const walletProvider: WalletProviderDiagnostics = {
    hasEthereum: typeof window !== 'undefined' && typeof (window as unknown as { ethereum?: unknown }).ethereum === 'object',
    requestedMode: includeWalletMetrics ? (walletMode === 'mock' ? 'wallet-mock' : 'injected-wallet') : 'rpc',
  }
  if (walletProvider.hasEthereum) {
    const ethereum = (window as unknown as { ethereum?: Record<string, unknown> }).ethereum
    if (ethereum && typeof ethereum === 'object') {
      walletProvider.isMetaMask = Boolean(ethereum.isMetaMask)
      walletProvider.providerKeys = Object.keys(ethereum).slice(0, 20)
    }
  }

  try {
    if (
      includeWalletMetrics &&
      (!('eth_requestAccounts' in adapter) || typeof adapter.eth_requestAccounts !== 'function')
    ) {
      throw new Error(
        'Wallet provider is not available in this browser session. Wallet metrics require window.ethereum (or wallet-mock in E2E).'
      )
    }

    const ops = includeWalletMetrics
      ? walletMode === 'injected'
        ? WALLET_OPERATIONS_INJECTED
        : WALLET_OPERATIONS_MOCK
      : RPC_OPERATIONS
    const effectiveRepeats = includeWalletMetrics ? Math.min(repeats, 1) : repeats

    for (const op of ops) {
      try {
        const timings = await measureOperationTimings(op, adapter, effectiveRepeats)
        const stats = computeStats(timings)
        results.push({ operationId: op.id, name: op.name, timings, stats })
      } catch (e) {
        results.push({
          operationId: op.id,
          name: op.name,
          timings: [],
          stats: computeStats([]),
          error: formatError(e),
        })
        operationErrors.push(`${op.name}: ${formatError(e)}`)
      }
    }

    if (includeWalletMetrics) {
      const walletConnectOp = results.find((r) => r.operationId === 'wallet_connect')
      if (walletConnectOp) {
        connectWalletMs = walletConnectOp.stats.mean ?? undefined
      }
    }
  } catch (e) {
    error = formatError(e)
  }

  const coldFromWindow = typeof window !== 'undefined' ? (window as unknown as { __benchmarkColdStartMs?: number }).__benchmarkColdStartMs : undefined
  const resultSet: BenchmarkResultSet = {
    libId,
    timestamp: Date.now(),
    coldStartMs: coldStartMs ?? coldFromWindow,
    hotStartMs,
    connectWalletMs,
    operations: results,
    error: error ?? (operationErrors.length > 0 ? operationErrors.join(' | ') : undefined),
    walletProvider,
  }

  if (typeof window !== 'undefined') {
    window.__benchmarkResults = resultSet
  }
  return resultSet
}
