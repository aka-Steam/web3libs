import { createContext, useContext } from 'react'
import type { Web3Adapter } from '../adapters/types'

const defaultRpcUrl = 'http://127.0.0.1:8545'

export const Web3AdapterContext = createContext<{
  adapter: Web3Adapter | null
  libId: string | null
  rpcUrl: string
  error: string | null
  loading: boolean
  createAdapterForRpc: (rpcUrl: string) => Web3Adapter
}>({
  adapter: null,
  libId: null,
  rpcUrl: defaultRpcUrl,
  error: null,
  loading: true,
  createAdapterForRpc: () => {
    throw new Error('Web3AdapterContext: createAdapterForRpc used outside provider')
  },
})

export function useWeb3Adapter() {
  return useContext(Web3AdapterContext)
}

export function getRpcUrl(): string {
  return typeof import.meta !== 'undefined' && import.meta.env?.VITE_RPC_URL
    ? String(import.meta.env.VITE_RPC_URL)
    : defaultRpcUrl
}

export function getLibFromUrl(): string {
  if (typeof window === 'undefined') return 'ethers'
  const params = new URLSearchParams(window.location.search)
  return params.get('lib') ?? 'ethers'
}
