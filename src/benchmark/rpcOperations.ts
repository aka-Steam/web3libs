import type { Web3Adapter } from '../adapters/types'

const TEST_ADDRESS = '0x0000000000000000000000000000000000000001'

export interface RpcOperation {
  id: string
  name: string
  requiresWallet?: boolean
  run: (adapter: Web3Adapter) => Promise<void>
}

// RPC-операции, не требующие кошелька (используются в rpc-*.json)
export const RPC_OPERATIONS: RpcOperation[] = [
  { id: 'web3_clientVersion', name: 'web3_clientVersion', run: (a) => a.web3_clientVersion().then(() => {}) },
  { id: 'web3_sha3', name: 'web3_sha3', run: (a) => a.web3_sha3('0x68656c6c6f').then(() => {}) },
  { id: 'net_version', name: 'net_version', run: (a) => a.net_version().then(() => {}) },
  { id: 'net_peerCount', name: 'net_peerCount', run: (a) => a.net_peerCount().then(() => {}) },
  { id: 'net_listening', name: 'net_listening', run: (a) => a.net_listening().then(() => {}) },
  { id: 'eth_chainId', name: 'eth_chainId', run: (a) => a.eth_chainId().then(() => {}) },
  { id: 'eth_syncing', name: 'eth_syncing', run: (a) => a.eth_syncing().then(() => {}) },
  { id: 'eth_blockNumber', name: 'eth_blockNumber', run: (a) => a.eth_blockNumber().then(() => {}) },
  { id: 'eth_getBalance', name: 'eth_getBalance', run: (a) => a.eth_getBalance(TEST_ADDRESS).then(() => {}) },
  { id: 'eth_getCode', name: 'eth_getCode', run: (a) => a.eth_getCode(TEST_ADDRESS).then(() => {}) },
  { id: 'eth_getStorageAt', name: 'eth_getStorageAt', run: (a) => a.eth_getStorageAt(TEST_ADDRESS, '0x0').then(() => {}) },
  { id: 'eth_getTransactionCount', name: 'eth_getTransactionCount', run: (a) => a.eth_getTransactionCount(TEST_ADDRESS).then(() => {}) },
  { id: 'eth_call', name: 'eth_call', run: (a) => a.eth_call({ to: TEST_ADDRESS, data: '0x' }).then(() => {}) },
  { id: 'eth_estimateGas', name: 'eth_estimateGas', run: (a) => a.eth_estimateGas({ to: TEST_ADDRESS }).then(() => {}) },
  { id: 'eth_gasPrice', name: 'eth_gasPrice', run: (a) => a.eth_gasPrice().then(() => {}) },
  { id: 'eth_maxPriorityFeePerGas', name: 'eth_maxPriorityFeePerGas', run: (a) => a.eth_maxPriorityFeePerGas().then(() => {}) },
  { id: 'eth_feeHistory', name: 'eth_feeHistory', run: (a) => a.eth_feeHistory(4, 'latest', [25, 75]).then(() => {}) },
  { id: 'eth_getBlockByNumber', name: 'eth_getBlockByNumber', run: (a) => a.eth_getBlockByNumber('latest', false).then(() => {}) },
  { id: 'eth_getBlockByHash', name: 'eth_getBlockByHash', run: async (a) => { const b = await a.eth_getBlockByNumber('latest'); if (b?.hash) await a.eth_getBlockByHash(b.hash, false) } },
  { id: 'eth_getTransactionByHash', name: 'eth_getTransactionByHash', run: async (a) => { const b = await a.eth_getBlockByNumber('latest', true); const txHash = b?.transactions?.[0]; if (typeof txHash === 'string') await a.eth_getTransactionByHash(txHash) } },
  { id: 'eth_getTransactionReceipt', name: 'eth_getTransactionReceipt', run: async (a) => { const b = await a.eth_getBlockByNumber('latest', true); const txHash = b?.transactions?.[0]; if (typeof txHash === 'string') await a.eth_getTransactionReceipt(txHash) } },
  { id: 'eth_getLogs', name: 'eth_getLogs', run: (a) => a.eth_getLogs({ fromBlock: 'latest', toBlock: 'latest' }).then(() => {}) },
  { id: 'eth_getBlockTransactionCountByNumber', name: 'eth_getBlockTransactionCountByNumber', run: (a) => a.eth_getBlockTransactionCountByNumber('latest').then(() => {}) },
  { id: 'eth_getTransactionByBlockNumberAndIndex', name: 'eth_getTransactionByBlockNumberAndIndex', run: (a) => a.eth_getTransactionByBlockNumberAndIndex('latest', 0).then(() => {}) },
  { id: 'eth_getUncleCountByBlockNumber', name: 'eth_getUncleCountByBlockNumber', run: (a) => a.eth_getUncleCountByBlockNumber('latest').then(() => {}) },
  { id: 'eth_getUncleByBlockNumberAndIndex', name: 'eth_getUncleByBlockNumberAndIndex', run: (a) => a.eth_getUncleByBlockNumberAndIndex('latest', 0).then(() => {}) },
]

// Операции, требующие наличия кошелька (используются в wallet-*.json)
export const WALLET_OPERATIONS: RpcOperation[] = [
  {
    id: 'wallet_connect',
    name: 'eth_requestAccounts',
    requiresWallet: true,
    run: async (adapter) => {
      if (!('eth_requestAccounts' in adapter) || typeof adapter.eth_requestAccounts !== 'function') {
        throw new Error('Wallet adapter is not available')
      }
      await adapter.eth_requestAccounts()
    },
  },
  {
    id: 'wallet_prepareTransaction',
    name: 'prepareRawTransaction',
    requiresWallet: true,
    run: async (adapter) => {
      if (!('prepareRawTransaction' in adapter) || typeof adapter.prepareRawTransaction !== 'function') {
        throw new Error('Wallet adapter does not support prepareRawTransaction')
      }
      const chainId = await adapter.eth_chainId()
      await adapter.prepareRawTransaction({
        to: TEST_ADDRESS,
        value: 0n,
        data: '0x',
        gasLimit: 21000n,
        chainId,
      })
    },
  },
  // wallet_sendRawTransaction временно отключён: требует confirmTransaction/confirmSignature
  // в Synpress при каждом вызове; можно включить при наличии автоматизации popup.
]
