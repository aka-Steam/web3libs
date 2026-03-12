import { useState } from 'react'
import { useWeb3Adapter } from '../context/Web3AdapterContext'
import { runBenchmark } from '../benchmark/runner'
import type { BenchmarkResultSet } from '../benchmark/runner'

export interface BenchmarkPanelProps {
  onResult?: (result: BenchmarkResultSet | null) => void
}

export function BenchmarkPanel({ onResult }: BenchmarkPanelProps) {
  const { adapter, libId, error, loading } = useWeb3Adapter()
  const [repeats, setRepeats] = useState(100)
  const [includeWallet, setIncludeWallet] = useState(false)
  const [running, setRunning] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [lastResult, setLastResult] = useState<BenchmarkResultSet | null>(null)

  const hasWallet = adapter && 'eth_requestAccounts' in adapter && typeof adapter.eth_requestAccounts === 'function'

  const onConnect = async () => {
    if (!hasWallet) return
    setConnecting(true)
    try {
      await adapter!.eth_requestAccounts!()
    } finally {
      setConnecting(false)
    }
  }

  const onRun = async () => {
    if (!adapter) return
    setRunning(true)
    setLastResult(null)
    onResult?.(null)
    try {
      const result = await runBenchmark(adapter, { repeats, includeWalletMetrics: includeWallet })
      setLastResult(result)
      onResult?.(result)
    } finally {
      setRunning(false)
    }
  }

  return (
    <section style={{ marginTop: '1rem' }}>
      <h2>Benchmark</h2>
      {loading && <p>Loading adapter…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && adapter && (
        <>
          <p>Library: <strong>{libId}</strong></p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <label>
              Repeats:{' '}
              <input
                type="number"
                min={1}
                max={1000}
                value={repeats}
                onChange={(e) => setRepeats(Number(e.target.value) || 100)}
                data-testid="benchmark-repeats"
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={includeWallet}
                onChange={(e) => setIncludeWallet(e.target.checked)}
                data-testid="include-wallet"
              />
              {' '}Include connectWallet
            </label>
            {hasWallet && (
              <button
                type="button"
                onClick={onConnect}
                disabled={connecting}
                data-testid="connect-wallet"
              >
                {connecting ? 'Connecting…' : 'Connect wallet'}
              </button>
            )}
            <button
              onClick={onRun}
              disabled={running}
              data-testid="run-benchmark"
            >
              {running ? 'Running…' : 'Run benchmark'}
            </button>
          </div>
          {lastResult && (
            <p style={{ marginTop: '0.5rem' }}>
              Done. {lastResult.operations.length} operations, cold start: {lastResult.coldStartMs != null ? `${lastResult.coldStartMs.toFixed(2)} ms` : '—'}
            </p>
          )}
        </>
      )}
    </section>
  )
}
