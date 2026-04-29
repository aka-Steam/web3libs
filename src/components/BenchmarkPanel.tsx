import { useState } from 'react'
import { useWeb3Adapter } from '../context/Web3AdapterContext'
import { runBenchmark } from '../benchmark/runner'
import type { BenchmarkResultSet } from '../benchmark/runner'
import { clampRepeats, featureFlags } from '../config/featureFlags'

export interface BenchmarkPanelProps {
  onResult?: (result: BenchmarkResultSet | null) => void
}

export function BenchmarkPanel({ onResult }: BenchmarkPanelProps) {
  const { adapter, libId, error, loading } = useWeb3Adapter()
  const [repeats, setRepeats] = useState(() => clampRepeats(20))
  const [includeWallet, setIncludeWallet] = useState(false)
  const [walletMode, setWalletMode] = useState<'mock' | 'injected'>('mock')
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

  const walletUiAllowed = featureFlags.allowWalletBenchmarkUi
  const effectiveIncludeWallet = walletUiAllowed && includeWallet

  const onRun = async () => {
    if (!adapter) return
    const repeatsResolved = clampRepeats(repeats)
    setRepeats(repeatsResolved)
    if (effectiveIncludeWallet && !hasWallet) {
      const result: BenchmarkResultSet = {
        libId: adapter.libId,
        timestamp: Date.now(),
        operations: [],
        error: 'Wallet metrics are unavailable: no injected wallet provider (window.ethereum).',
      }
      setLastResult(result)
      onResult?.(result)
      return
    }
    setRunning(true)
    setLastResult(null)
    onResult?.(null)
    try {
      const result = await runBenchmark(adapter, {
        repeats: repeatsResolved,
        includeWalletMetrics: effectiveIncludeWallet,
        walletMode,
      })
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
                max={featureFlags.maxRepeats}
                value={repeats}
                onChange={(e) =>
                  setRepeats(clampRepeats(e.target.value === '' ? 1 : e.target.value))
                }
                data-testid="benchmark-repeats"
              />
            </label>
            {walletUiAllowed && (
              <label>
                <input
                  type="checkbox"
                  checked={includeWallet}
                  onChange={(e) => setIncludeWallet(e.target.checked)}
                  disabled={!hasWallet}
                  data-testid="include-wallet"
                />
                {' '}Include connectWallet
              </label>
            )}
            {walletUiAllowed && includeWallet && (
              <label>
                Wallet mode:{' '}
                <select
                  value={walletMode}
                  onChange={(e) => setWalletMode(e.target.value as 'mock' | 'injected')}
                  data-testid="wallet-mode"
                >
                  <option value="mock">wallet-mock (sign + sendRaw)</option>
                  <option value="injected">injected wallet (sendTransaction)</option>
                </select>
              </label>
            )}
            {walletUiAllowed && !hasWallet && (
              <p style={{ margin: 0, color: '#a65d00' }}>
                Wallet provider is not detected in UI session.
              </p>
            )}
            {walletUiAllowed && hasWallet && (
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
