import type { Web3Adapter } from '../adapters/types'
import { computeStats, type TimingStats } from './stats'
import { RPC_OPERATIONS, WALLET_OPERATIONS } from './rpcOperations'

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
}

export interface BenchmarkResultSet {
  libId: string
  timestamp: number
  coldStartMs?: number
  hotStartMs?: number
  connectWalletMs?: number
  operations: OperationResult[]
  error?: string
}

export interface RunBenchmarkOptions {
  repeats?: number
  /**
   * If true, benchmark only wallet-related operations (wallet-*.json).
   * If false/omitted, benchmark only public RPC operations (rpc-*.json).
   */
  includeWalletMetrics?: boolean
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
 * Run full benchmark: all RPC operations + optional cold/hot start and connectWallet.
 * Results are written to window.__benchmarkResults for E2E to read.
 */
export async function runBenchmark(
  adapter: Web3Adapter,
  options: RunBenchmarkOptions = {}
): Promise<BenchmarkResultSet> {
  const { repeats = 100, includeWalletMetrics = false } = options
  const libId = adapter.libId
  const results: OperationResult[] = []
  let coldStartMs: number | undefined
  let hotStartMs: number | undefined
  let connectWalletMs: number | undefined
  let error: string | undefined

  try {
    const ops = includeWalletMetrics ? WALLET_OPERATIONS : RPC_OPERATIONS
    const effectiveRepeats = includeWalletMetrics ? Math.min(repeats, 1) : repeats

    for (const op of ops) {
      try {
        const timings = await runAndMeasure(() => op.run(adapter), effectiveRepeats)
        const stats = computeStats(timings)
        results.push({ operationId: op.id, name: op.name, timings, stats })
      } catch (e) {
        results.push({
          operationId: op.id,
          name: op.name,
          timings: [],
          stats: computeStats([]),
        })
        error = e instanceof Error ? e.message : String(e)
      }
    }

    if (includeWalletMetrics) {
      const walletConnectOp = results.find((r) => r.operationId === 'wallet_connect')
      if (walletConnectOp) {
        connectWalletMs = walletConnectOp.stats.mean ?? undefined
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  const coldFromWindow = typeof window !== 'undefined' ? (window as unknown as { __benchmarkColdStartMs?: number }).__benchmarkColdStartMs : undefined
  const resultSet: BenchmarkResultSet = {
    libId,
    timestamp: Date.now(),
    coldStartMs: coldStartMs ?? coldFromWindow,
    hotStartMs,
    connectWalletMs,
    operations: results,
    error,
  }

  if (typeof window !== 'undefined') {
    window.__benchmarkResults = resultSet
  }
  return resultSet
}
