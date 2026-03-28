import { useState } from 'react'
import { useWeb3Adapter } from './context/Web3AdapterContext'
import { BenchmarkPanel } from './components/BenchmarkPanel'
import { ResultsView } from './components/ResultsView'
import { NegativeTestsPanel } from './components/NegativeTestsPanel'
import { featureFlags } from './config/featureFlags'
import type { BenchmarkResultSet } from './benchmark/runner'

function App() {
  const { adapter, libId, error, loading } = useWeb3Adapter()
  const [lastResult, setLastResult] = useState<BenchmarkResultSet | null>(null)

  const setLib = (lib: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('lib', lib)
    window.location.href = url.pathname + '?' + url.searchParams.toString()
  }

  return (
    <div>
      <h1>Web3 Test Stand</h1>
      <p style={{ marginBottom: '0.5rem' }}>Библиотека:</p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {(['ethers', 'viem', 'web3'] as const).map((lib) => (
          <button
            key={lib}
            type="button"
            onClick={() => setLib(lib)}
            style={{
              fontWeight: libId === lib ? 'bold' : 'normal',
              ...(libId === lib ? { outline: '2px solid #0a7ea4', outlineOffset: 2 } : {}),
            }}
          >
            {lib}
          </button>
        ))}
      </div>
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
