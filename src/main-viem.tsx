import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createViemAdapter } from './adapters/viemAdapter'
import { Web3AdapterContext } from './context/Web3AdapterContext'
import { getRpcUrl } from './context/Web3AdapterContext'
import App from './App.tsx'
import './index.css'

const rpcUrl = getRpcUrl()
const ethereum = typeof window !== 'undefined' ? (window as unknown as { ethereum?: import('./adapters/viemAdapter').EIP1193Provider }).ethereum : undefined
const adapter = createViemAdapter({ rpcUrl, ethereum })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Web3AdapterContext.Provider
      value={{
        adapter,
        libId: 'viem',
        rpcUrl,
        error: null,
        loading: false,
      }}
    >
      <App />
    </Web3AdapterContext.Provider>
  </StrictMode>,
)
