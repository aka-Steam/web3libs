import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Web3AdapterContext, getRpcUrl, getLibFromUrl } from './context/Web3AdapterContext'
import { loadAdapter } from './adapters/loadAdapter'
import type { EIP1193Provider } from './adapters/ethersAdapter'
import App from './App.tsx'
import './index.css'

function Main() {
  const [adapter, setAdapter] = useState<import('./adapters/types').Web3Adapter | null>(null)
  const [libId, setLibId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [createAdapterForRpc, setCreateAdapterForRpc] = useState<
    ((url: string) => import('./adapters/types').Web3Adapter) | null
  >(null)
  const rpcUrl = getRpcUrl()

  useEffect(() => {
    const validLib = getLibFromUrl()
    setLibId(validLib)

    const load = async () => {
      setLoading(true)
      setError(null)
      setCreateAdapterForRpc(null)
      const coldStart = typeof performance !== 'undefined' ? performance.now() : 0
      try {
        const ethereum =
          typeof window !== 'undefined'
            ? (window as unknown as { ethereum?: EIP1193Provider }).ethereum
            : undefined
        const { instance, createForRpc } = await loadAdapter(validLib, rpcUrl, ethereum)
        const coldStartMs = typeof performance !== 'undefined' ? performance.now() - coldStart : undefined
        if (typeof window !== 'undefined' && coldStartMs !== undefined) {
          ;(window as unknown as { __benchmarkColdStartMs?: number }).__benchmarkColdStartMs = coldStartMs
        }
        setAdapter(instance)
        setCreateAdapterForRpc(() => createForRpc)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [rpcUrl])

  return (
    <Web3AdapterContext.Provider
      value={{
        adapter,
        libId,
        rpcUrl,
        error,
        loading,
        createAdapterForRpc:
          createAdapterForRpc ??
          ((_url: string) => {
            throw new Error('Adapter is not ready')
          }),
      }}
    >
      <App />
    </Web3AdapterContext.Provider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Main />
  </StrictMode>,
)
