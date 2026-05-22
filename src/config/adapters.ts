import raw from './featureFlags.json'

/** Query param `?lib=` value and benchmark export `libId`. */
export type AdapterId = 'ethers' | 'ethers-rpc' | 'viem' | 'web3'

export interface AdapterOption {
  id: AdapterId
  /** UI button label */
  label: string
  /** Key in featureFlags.json → adapters */
  flagKey: 'ethers' | 'ethersRpc' | 'viem' | 'web3'
  description: string
}

export const ADAPTER_OPTIONS: AdapterOption[] = [
  {
    id: 'ethers',
    flagKey: 'ethers',
    label: 'ethers (Provider)',
    description: 'JsonRpcProvider и high-level API из документации ethers',
  },
  {
    id: 'ethers-rpc',
    flagKey: 'ethersRpc',
    label: 'ethers (RPC parity)',
    description: 'Тонкий JSON-RPC; один метод бенчмарка ≈ один RPC (сравнение с viem/web3)',
  },
  {
    id: 'viem',
    flagKey: 'viem',
    label: 'viem',
    description: 'createPublicClient + http transport',
  },
  {
    id: 'web3',
    flagKey: 'web3',
    label: 'web3',
    description: 'Web3.js v4 eth API',
  },
]

type AdapterFlagsJson = {
  ethers?: boolean
  ethersRpc?: boolean
  viem?: boolean
  web3?: boolean
}

function readAdapterFlags(): Record<AdapterOption['flagKey'], boolean> {
  const a = (raw as { adapters?: AdapterFlagsJson }).adapters ?? {}
  return {
    ethers: a.ethers !== false,
    ethersRpc: a.ethersRpc === true,
    viem: a.viem !== false,
    web3: a.web3 !== false,
  }
}

const adapterFlags = readAdapterFlags()

/** Adapters enabled in featureFlags.json (shown in UI, loadable via ?lib=). */
export function getEnabledAdapters(): AdapterOption[] {
  return ADAPTER_OPTIONS.filter((opt) => adapterFlags[opt.flagKey])
}

export function isAdapterEnabled(id: AdapterId): boolean {
  const opt = ADAPTER_OPTIONS.find((o) => o.id === id)
  return opt ? adapterFlags[opt.flagKey] : false
}

const ALL_IDS: AdapterId[] = ['ethers', 'ethers-rpc', 'viem', 'web3']

export function isAdapterId(value: string): value is AdapterId {
  return (ALL_IDS as string[]).includes(value)
}

/**
 * Resolve ?lib= from URL: must be enabled; otherwise first enabled adapter or ethers.
 */
export function resolveAdapterIdFromUrl(urlLib: string | null | undefined): AdapterId {
  const enabled = getEnabledAdapters()
  if (enabled.length === 0) {
    return 'ethers'
  }
  if (urlLib && isAdapterId(urlLib) && isAdapterEnabled(urlLib)) {
    return urlLib
  }
  const preferred = enabled.find((o) => o.id === 'ethers') ?? enabled[0]
  return preferred!.id
}

export function getDefaultAdapterId(): AdapterId {
  return resolveAdapterIdFromUrl('ethers')
}
