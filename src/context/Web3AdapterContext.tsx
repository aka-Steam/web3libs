import { createContext, useContext } from 'react'
import type { Web3Adapter } from '../adapters/types'
import type { AdapterId } from '../config/adapters'
import { resolveAdapterIdFromUrl } from '../config/adapters'

const defaultRpcUrl = '/rpc'

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
  const raw = typeof import.meta !== 'undefined' && import.meta.env?.VITE_RPC_URL
    ? String(import.meta.env.VITE_RPC_URL)
    : defaultRpcUrl

  // Some browser providers (notably web3.js and occasionally ethers) expect
  // an absolute URL and may fail on relative "/rpc" values.
  if (typeof window !== 'undefined' && raw.startsWith('/')) {
    return new URL(raw, window.location.origin).toString()
  }

  return raw
}

/** Resolved adapter id from `?lib=` (only enabled adapters from featureFlags). */
export function getLibFromUrl(): AdapterId {
  if (typeof window === 'undefined') return 'ethers'
  const params = new URLSearchParams(window.location.search)
  return resolveAdapterIdFromUrl(params.get('lib'))
}
