/**
 * Stub for future web3.js adapter. All methods throw.
 * Use ?lib=web3 to load; implement later with web3 package.
 */
import type { Web3Adapter } from './types'

const NOT_IMPLEMENTED = 'web3.js adapter not implemented yet'

export interface Web3AdapterOptions {
  rpcUrl: string
  ethereum?: import('./ethersAdapter').EIP1193Provider
}

export function createWeb3Adapter(_options: Web3AdapterOptions): Web3Adapter {
  const throwNotImplemented = async (): Promise<never> => {
    throw new Error(NOT_IMPLEMENTED)
  }

  const adapter: Web3Adapter = {
    libId: 'web3',

    web3_clientVersion: throwNotImplemented,
    web3_sha3: throwNotImplemented,
    net_version: throwNotImplemented,
    net_peerCount: throwNotImplemented,
    net_listening: throwNotImplemented,
    eth_chainId: throwNotImplemented,
    eth_syncing: throwNotImplemented,
    eth_blockNumber: throwNotImplemented,
    eth_getBalance: throwNotImplemented,
    eth_getCode: throwNotImplemented,
    eth_getStorageAt: throwNotImplemented,
    eth_getTransactionCount: throwNotImplemented,
    eth_call: throwNotImplemented,
    eth_estimateGas: throwNotImplemented,
    eth_gasPrice: throwNotImplemented,
    eth_maxPriorityFeePerGas: throwNotImplemented,
    eth_feeHistory: throwNotImplemented,
    eth_getBlockByNumber: throwNotImplemented,
    eth_getBlockByHash: throwNotImplemented,
    eth_getTransactionByHash: throwNotImplemented,
    eth_getTransactionReceipt: throwNotImplemented,
    eth_getLogs: throwNotImplemented,
    eth_getBlockTransactionCountByNumber: throwNotImplemented,
    eth_getTransactionByBlockNumberAndIndex: throwNotImplemented,
    eth_getUncleCountByBlockNumber: throwNotImplemented,
    eth_getUncleByBlockNumberAndIndex: throwNotImplemented,
  }

  return adapter
}
