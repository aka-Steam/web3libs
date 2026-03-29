import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createWeb3Adapter } from './adapters/web3Adapter'
import { Web3AdapterContext, getRpcUrl } from './context/Web3AdapterContext'
import App from './App.tsx'
import './index.css'

const rpcUrl = getRpcUrl()
const ethereum = typeof window !== 'undefined' ? (window as unknown as { ethereum?: import('./adapters/web3Adapter').EIP1193Provider }).ethereum : undefined
const adapter = createWeb3Adapter({ rpcUrl, ethereum })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Web3AdapterContext.Provider
      value={{
        adapter,
        libId: 'web3',
        rpcUrl,
        error: null,
        loading: false,
        createAdapterForRpc: (url) => createWeb3Adapter({ rpcUrl: url, ethereum }),
      }}
    >
      <App />
    </Web3AdapterContext.Provider>
  </StrictMode>,
)
