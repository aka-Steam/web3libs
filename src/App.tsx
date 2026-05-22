import { useState } from 'react'
import { useWeb3Adapter } from './context/Web3AdapterContext'
import { BenchmarkPanel } from './components/BenchmarkPanel'
import { ResultsView } from './components/ResultsView'
import { NegativeTestsPanel } from './components/NegativeTestsPanel'
import { featureFlags } from './config/featureFlags'
import { getEnabledAdapters, type AdapterId } from './config/adapters'
import type { BenchmarkResultSet } from './benchmark/runner'

function App() {
  const { adapter, libId, error, loading } = useWeb3Adapter()
  const [lastResult, setLastResult] = useState<BenchmarkResultSet | null>(null)
  const enabledAdapters = getEnabledAdapters()

  const setLib = (lib: AdapterId) => {
    const url = new URL(window.location.href)
    url.searchParams.set('lib', lib)
    window.location.href = url.pathname + '?' + url.searchParams.toString()
  }

  return (
    <div>
      <h1>Web3 Test Stand</h1>
      <p style={{ marginBottom: '0.5rem' }}>Библиотека / режим адаптера:</p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {enabledAdapters.map((opt) => (
          <button
            key={opt.id}
            type="button"
            title={opt.description}
            onClick={() => setLib(opt.id)}
            style={{
              fontWeight: libId === opt.id ? 'bold' : 'normal',
              ...(libId === opt.id ? { outline: '2px solid #0a7ea4', outlineOffset: 2 } : {}),
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {enabledAdapters.length === 0 && (
        <p style={{ color: 'red' }}>No adapters enabled. Enable at least one in src/config/featureFlags.json → adapters.</p>
      )}
      {!featureFlags.adapters.ethersRpc && featureFlags.adapters.ethers && (
        <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#555' }}>
          Режим <strong>ethers (RPC parity)</strong> выключен в featureFlags (ethersRpc: false). Включите для сравнения тонкого JSON-RPC.
        </p>
      )}
      {loading && <p>Loading adapter…</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {!loading && !error && adapter && <p>Adapter: {libId}</p>}
      <BenchmarkPanel onResult={setLastResult} />
      <ResultsView result={lastResult} />
      {featureFlags.negativeTestsPanel && <NegativeTestsPanel />}
    </div>
  )
}

export default App
