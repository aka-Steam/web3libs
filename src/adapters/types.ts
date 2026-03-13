/**
 * Types and IWeb3Adapter interface for Web3 test stand.
 * Covers JSON-RPC methods: web3_*, net_*, eth_* (read + optional wallet).
 */

export type BlockTag = 'latest' | 'earliest' | 'pending' | bigint

export interface Block {
  number: bigint
  hash: string
  parentHash: string
  timestamp: bigint
  gasLimit: bigint
  gasUsed: bigint
  baseFeePerGas?: bigint
  transactions: string[]
  [key: string]: unknown
}

export interface Transaction {
  hash: string
  blockNumber?: bigint
  blockHash?: string
  from: string
  to?: string
  value: bigint
  gas: bigint
  gasPrice?: bigint
  input: string
  nonce: number
  [key: string]: unknown
}

export interface TransactionReceipt {
  blockNumber: bigint
  blockHash: string
  transactionHash: string
  gasUsed: bigint
  status: 'success' | 'reverted'
  logs: Log[]
  [key: string]: unknown
}

export interface Log {
  address: string
  topics: string[]
  data: string
  blockNumber: bigint
  transactionHash: string
  [key: string]: unknown
}

export interface FeeHistoryResult {
  oldestBlock: bigint
  baseFeePerGas: bigint[]
  gasUsedRatio: number[]
  reward?: bigint[][]
}

/** Public RPC (no wallet) */
export interface IWeb3Adapter {
  readonly libId: 'ethers' | 'viem' | 'web3'

  // web3_*
  web3_clientVersion(): Promise<string>
  web3_sha3(data: string): Promise<string>

  // net_*
  net_version(): Promise<string>
  net_peerCount(): Promise<bigint>
  net_listening(): Promise<boolean>

  // eth_* — chain & sync
  eth_chainId(): Promise<bigint>
  eth_syncing(): Promise<boolean | object>
  eth_blockNumber(): Promise<bigint>

  // eth_* — state
  eth_getBalance(address: string, block?: BlockTag): Promise<bigint>
  eth_getCode(address: string, block?: BlockTag): Promise<string>
  eth_getStorageAt(address: string, slot: string, block?: BlockTag): Promise<string>
  eth_getTransactionCount(address: string, block?: BlockTag): Promise<number>

  // eth_call, eth_estimateGas
  eth_call(params: { to: string; data: string; from?: string; gas?: bigint }, block?: BlockTag): Promise<string>
  eth_estimateGas(params: { to?: string; from?: string; data?: string; value?: bigint }): Promise<bigint>

  // eth_* — gas/fees
  eth_gasPrice(): Promise<bigint>
  eth_maxPriorityFeePerGas(): Promise<bigint>
  eth_feeHistory(blockCount: number, newestBlock: BlockTag, rewardPercentiles?: number[]): Promise<FeeHistoryResult>

  // eth_* — blocks
  eth_getBlockByNumber(block: BlockTag, fullTransactions?: boolean): Promise<Block | null>
  eth_getBlockByHash(hash: string, fullTransactions?: boolean): Promise<Block | null>

  // eth_* — transactions
  eth_getTransactionByHash(hash: string): Promise<Transaction | null>
  eth_getTransactionReceipt(hash: string): Promise<TransactionReceipt | null>

  // eth_getLogs
  eth_getLogs(filter: {
    fromBlock?: BlockTag
    toBlock?: BlockTag
    address?: string | string[]
    topics?: (string | string[] | null)[]
  }): Promise<Log[]>

  // eth_* — block tx index
  eth_getBlockTransactionCountByNumber(block: BlockTag): Promise<number>
  eth_getTransactionByBlockNumberAndIndex(block: BlockTag, index: number): Promise<Transaction | null>

  // Uncle (optional)
  eth_getUncleCountByBlockNumber(block: BlockTag): Promise<number>
  eth_getUncleByBlockNumberAndIndex(block: BlockTag, index: number): Promise<Block | null>
}

/** Wallet-related operations (optional; require window.ethereum) */
export interface IWeb3WalletAdapter {
  /** eth_requestAccounts — connect wallet, returns accounts */
  eth_requestAccounts(): Promise<string[]>

  /** Prepare and return serialized unsigned tx (for round-trip benchmark: app prepares, wallet signs & sends) */
  prepareRawTransaction(params: {
    to: string
    value?: bigint
    data?: string
    gasLimit?: bigint
    chainId: bigint
  }): Promise<{ serialized: string; nonce: number }>

  /** Sign transaction and return signed raw hex (without sending it) */
  signTransaction(params: {
    to: string
    value?: bigint
    data?: string
    gasLimit?: bigint
    chainId: bigint
  }): Promise<string>

  /** Send already-signed raw tx (hex string from MetaMask) */
  eth_sendRawTransaction(signedHex: string): Promise<string>
}

export type Web3Adapter = IWeb3Adapter & Partial<IWeb3WalletAdapter>
