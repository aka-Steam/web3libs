import type { AdapterId } from '../config/adapters'
import type { Web3Adapter } from './types'
import type { EIP1193Provider } from './ethersAdapter'

export interface LoadAdapterResult {
  instance: Web3Adapter
  createForRpc: (rpcUrl: string) => Web3Adapter
}

export async function loadAdapter(
  id: AdapterId,
  rpcUrl: string,
  ethereum?: EIP1193Provider
): Promise<LoadAdapterResult> {
  switch (id) {
    case 'ethers': {
      const mod = await import('./ethersAdapter')
      return {
        instance: mod.createEthersAdapter({ rpcUrl, ethereum }),
        createForRpc: (url) => mod.createEthersAdapter({ rpcUrl: url, ethereum }),
      }
    }
    case 'ethers-rpc': {
      const mod = await import('./ethersRpcAdapter')
      return {
        instance: mod.createEthersRpcAdapter({ rpcUrl, ethereum }),
        createForRpc: (url) => mod.createEthersRpcAdapter({ rpcUrl: url, ethereum }),
      }
    }
    case 'viem': {
      const mod = await import('./viemAdapter')
      return {
        instance: mod.createViemAdapter({ rpcUrl, ethereum }),
        createForRpc: (url) => mod.createViemAdapter({ rpcUrl: url, ethereum }),
      }
    }
    case 'web3': {
      const mod = await import('./web3Adapter')
      return {
        instance: mod.createWeb3Adapter({ rpcUrl, ethereum }),
        createForRpc: (url) => mod.createWeb3Adapter({ rpcUrl: url, ethereum }),
      }
    }
    default: {
      const _exhaustive: never = id
      throw new Error(`Unknown adapter: ${_exhaustive}`)
    }
  }
}
