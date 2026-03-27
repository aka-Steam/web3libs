import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Web3AdapterContext, getRpcUrl, getLibFromUrl } from './context/Web3AdapterContext'
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
    const lib = getLibFromUrl()
    const validLib = lib === 'ethers' || lib === 'viem' || lib === 'web3' ? lib : 'ethers'
    setLibId(validLib)

    const load = async () => {
      setLoading(true)
      setError(null)
      setCreateAdapterForRpc(null)
      const coldStart = typeof performance !== 'undefined' ? performance.now() : 0
      try {
        const ethereum = typeof window !== 'undefined' ? (window as unknown as { ethereum?: import('./adapters/ethersAdapter').EIP1193Provider }).ethereum : undefined
        let instance: import('./adapters/types').Web3Adapter
        let createForRpc: (url: string) => import('./adapters/types').Web3Adapter
        if (validLib === 'ethers') {
          const mod = await import('./adapters/ethersAdapter')
          instance = mod.createEthersAdapter({ rpcUrl, ethereum })
          createForRpc = (url) => mod.createEthersAdapter({ rpcUrl: url, ethereum })
        } else if (validLib === 'viem') {
          const mod = await import('./adapters/viemAdapter')
          instance = mod.createViemAdapter({ rpcUrl, ethereum })
          createForRpc = (url) => mod.createViemAdapter({ rpcUrl: url, ethereum })
        } else {
          const mod = await import('./adapters/web3Adapter')
          instance = mod.createWeb3Adapter({ rpcUrl, ethereum })
          createForRpc = (url) => mod.createWeb3Adapter({ rpcUrl: url, ethereum })
        }
        const coldStartMs = typeof performance !== 'undefined' ? performance.now() - coldStart : undefined
        if (typeof window !== 'undefined' && coldStartMs !== undefined){
          (window as unknown as { __benchmarkColdStartMs?: number }).__benchmarkColdStartMs = coldStartMs
        };
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
