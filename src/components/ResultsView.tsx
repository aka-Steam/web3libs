import type { BenchmarkResultSet, OperationResult } from '../benchmark/runner'

export interface ResultsViewProps {
  result: BenchmarkResultSet | null
}

export function ResultsView({ result }: ResultsViewProps) {
  if (!result) return null

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `benchmark-${result.libId}-${result.timestamp}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section style={{ marginTop: '1rem' }}>
      <h2>Results</h2>
      {result.coldStartMs != null && <p>Cold start: {result.coldStartMs.toFixed(2)} ms</p>}
      {result.connectWalletMs != null && <p>connectWallet: {result.connectWalletMs.toFixed(2)} ms</p>}
      <button onClick={exportJson} type="button">Export JSON</button>
      <table style={{ width: '100%', marginTop: '0.5rem', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Operation</th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #ccc' }}>mean (ms)</th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #ccc' }}>p95 (ms)</th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #ccc' }}>min (ms)</th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #ccc' }}>max (ms)</th>
          </tr>
        </thead>
        <tbody>
          {result.operations.map((op: OperationResult) => (
            <tr key={op.operationId}>
              <td style={{ borderBottom: '1px solid #eee' }}>{op.name}</td>
              <td style={{ textAlign: 'right', borderBottom: '1px solid #eee' }}>{op.stats.mean.toFixed(2)}</td>
              <td style={{ textAlign: 'right', borderBottom: '1px solid #eee' }}>{op.stats.p95.toFixed(2)}</td>
              <td style={{ textAlign: 'right', borderBottom: '1px solid #eee' }}>{op.stats.min.toFixed(2)}</td>
              <td style={{ textAlign: 'right', borderBottom: '1px solid #eee' }}>{op.stats.max.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
