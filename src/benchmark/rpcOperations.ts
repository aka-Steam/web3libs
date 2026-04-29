import type { Web3Adapter } from '../adapters/types'

const TEST_ADDRESS = '0x0000000000000000000000000000000000000001'

export interface RpcOperation {
  id: string
  name: string
  requiresWallet?: boolean
  run: (adapter: Web3Adapter) => Promise<void>
  /**
   * Если задано, перед каждой итерацией замера вызывается `runSetup` (без таймера),
   * затем замеряется только `run`. Нужно для этапов вроде «только отправка» после подписи.
   */
  runSetup?: (adapter: Web3Adapter) => Promise<void>
}

// RPC-операции, не требующие кошелька (используются в rpc-*.json)
export const RPC_OPERATIONS: RpcOperation[] = [
  { id: 'web3_clientVersion', name: 'web3_clientVersion', run: (a) => a.web3_clientVersion().then(() => {}) },
  { id: 'web3_sha3', name: 'web3_sha3', run: (a) => a.web3_sha3('0x68656c6c6f').then(() => {}) },
  { id: 'net_version', name: 'net_version', run: (a) => a.net_version().then(() => {}) },
  // { id: 'net_peerCount', name: 'net_peerCount', run: (a) => a.net_peerCount().then(() => {}) },
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

const walletConnectOperation: RpcOperation = {
  id: 'wallet_connect',
  name: 'eth_requestAccounts',
  requiresWallet: true,
  run: async (adapter) => {
    if (!('eth_requestAccounts' in adapter) || typeof adapter.eth_requestAccounts !== 'function') {
      throw new Error('Wallet adapter is not available')
    }
    await adapter.eth_requestAccounts()
  },
}

const walletPrepareOperation: RpcOperation = {
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
}

const walletSignOperation: RpcOperation = {
  id: 'wallet_signTransaction',
  name: 'signTransaction',
  requiresWallet: true,
  run: async (adapter) => {
    if (!('signTransaction' in adapter) || typeof adapter.signTransaction !== 'function') {
      throw new Error('Wallet adapter does not support signTransaction')
    }
    const chainId = await adapter.eth_chainId()
    await adapter.signTransaction({
      to: TEST_ADDRESS,
      value: 0n,
      data: '0x',
      gasLimit: 21000n,
      chainId,
    })
  },
}

const walletSendTransactionOperation: RpcOperation = {
  id: 'wallet_eth_sendTransaction',
  name: 'eth_sendTransaction',
  requiresWallet: true,
  run: async (adapter) => {
    if (!('eth_sendTransaction' in adapter) || typeof adapter.eth_sendTransaction !== 'function') {
      throw new Error('Wallet adapter does not support eth_sendTransaction')
    }
    const chainId = await adapter.eth_chainId()
    await adapter.eth_sendTransaction({
      to: TEST_ADDRESS,
      value: 0n,
      data: '0x',
      gasLimit: 21000n,
      chainId,
    })
  },
}

// Операции для wallet-mock (поддерживают sign + sendRaw)
export const WALLET_OPERATIONS_MOCK: RpcOperation[] = [
  walletConnectOperation,
  walletPrepareOperation,
  walletSignOperation,
  createSendRawTransactionSendOnlyOperation(),
]

// Операции для реального injected-wallet (без signTransaction / sendRaw).
export const WALLET_OPERATIONS_INJECTED: RpcOperation[] = [
  walletConnectOperation,
  walletSendTransactionOperation,
]

// Backward compatibility default.
export const WALLET_OPERATIONS: RpcOperation[] = WALLET_OPERATIONS_MOCK

/** Замер только `eth_sendRawTransaction`: подпись в `runSetup`, в таймере — broadcast. */
function createSendRawTransactionSendOnlyOperation(): RpcOperation {
  let signedHex = ''
  return {
    id: 'wallet_eth_sendRawTransaction',
    name: 'eth_sendRawTransaction (send only)',
    requiresWallet: true,
    runSetup: async (adapter) => {
      if (!('signTransaction' in adapter) || typeof adapter.signTransaction !== 'function') {
        throw new Error('Wallet adapter does not support signTransaction')
      }
      if (!('eth_sendRawTransaction' in adapter) || typeof adapter.eth_sendRawTransaction !== 'function') {
        throw new Error('Wallet adapter does not support eth_sendRawTransaction')
      }
      const chainId = await adapter.eth_chainId()
      signedHex = await adapter.signTransaction({
        to: TEST_ADDRESS,
        value: 0n,
        data: '0x',
        gasLimit: 21000n,
        chainId,
      })
    },
    run: async (adapter) => {
      const send = adapter.eth_sendRawTransaction
      if (typeof send !== 'function') {
        throw new Error('Wallet adapter does not support eth_sendRawTransaction')
      }
      await send(signedHex)
    },
  }
}
