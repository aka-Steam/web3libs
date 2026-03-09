import {
  JsonRpcProvider,
  Transaction as EthersTx,
  getBytes,
  keccak256,
  toQuantity,
  type TransactionResponse,
  type Log as EthersLog,
} from 'ethers'
import type {
  BlockTag,
  Block,
  Transaction,
  TransactionReceipt,
  Log,
  IWeb3Adapter,
  IWeb3WalletAdapter,
  Web3Adapter,
} from './types'

const blockTagToString = (block?: BlockTag): string => {
  if (block === undefined) return 'latest'
  if (typeof block === 'bigint') return toQuantity(block)
  return block
}

interface EthersBlockLike {
  number: number
  hash: string | null
  parentHash: string
  timestamp: number
  gasLimit: bigint
  gasUsed: bigint
  baseFeePerGas: bigint | null
  transactions: string[]
}

const ethersBlockToBlock = (b: EthersBlockLike | null): Block | null => {
  if (!b) return null
  return {
    number: BigInt(b.number),
    hash: b.hash ?? '',
    parentHash: b.parentHash,
    timestamp: BigInt(b.timestamp),
    gasLimit: b.gasLimit,
    gasUsed: b.gasUsed,
    baseFeePerGas: b.baseFeePerGas ?? undefined,
    transactions: b.transactions,
  }
}

const txResponseToTx = (tx: TransactionResponse | null): Transaction | null => {
  if (!tx) return null
  return {
    hash: tx.hash,
    blockNumber: tx.blockNumber != null ? BigInt(tx.blockNumber) : undefined,
    blockHash: tx.blockHash ?? undefined,
    from: tx.from,
    to: tx.to ?? undefined,
    value: tx.value,
    gas: tx.gasLimit,
    gasPrice: tx.gasPrice ?? undefined,
    input: tx.data,
    nonce: tx.nonce,
  }
}

const receiptToReceipt = (r: { blockNumber: number; blockHash: string; transactionHash?: string; hash?: string; gasUsed: bigint; status?: number | null; logs: EthersLog[] } | null): TransactionReceipt | null => {
  if (!r) return null
  return {
    blockNumber: BigInt(r.blockNumber),
    blockHash: r.blockHash,
    transactionHash: r.transactionHash ?? r.hash ?? '',
    gasUsed: r.gasUsed,
    status: r.status === 1 ? 'success' : 'reverted',
    logs: r.logs.map((l) => ({
      address: l.address,
      topics: l.topics as string[],
      data: l.data,
      blockNumber: BigInt(l.blockNumber ?? 0),
      transactionHash: l.transactionHash ?? '',
    })),
  }
}

const ethersLogToLog = (l: EthersLog): Log => ({
  address: l.address,
  topics: l.topics as string[],
  data: l.data,
  blockNumber: BigInt(l.blockNumber),
  transactionHash: l.transactionHash ?? '',
})

export interface EthersAdapterOptions {
  rpcUrl: string
  ethereum?: EIP1193Provider
}

export interface EIP1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
}

export function createEthersAdapter(options: EthersAdapterOptions): Web3Adapter {
  const { rpcUrl, ethereum } = options
  const provider = new JsonRpcProvider(rpcUrl)

  const send = async <T>(method: string, params: unknown[] = []): Promise<T> => {
    return provider.send(method, params) as Promise<T>
  }

  const adapter: IWeb3Adapter = {
    libId: 'ethers',

    async web3_clientVersion() {
      return send<string>('web3_clientVersion', [])
    },
    async web3_sha3(data: string) {
      return keccak256(getBytes(data))
    },

    async net_version() {
      return send<string>('net_version', [])
    },
    async net_peerCount() {
      const hex = await send<string>('net_peerCount', [])
      return BigInt(hex)
    },
    async net_listening() {
      return send<boolean>('net_listening', [])
    },

    async eth_chainId() {
      const network = await provider.getNetwork()
      return network.chainId
    },
    async eth_syncing() {
      return send<boolean | object>('eth_syncing', [])
    },
    async eth_blockNumber() {
      const n = await provider.getBlockNumber()
      return BigInt(n)
    },

    async eth_getBalance(address: string, block?: BlockTag) {
      return provider.getBalance(address, blockTagToString(block))
    },
    async eth_getCode(address: string, block?: BlockTag) {
      return provider.getCode(address, blockTagToString(block))
    },
    async eth_getStorageAt(address: string, slot: string, block?: BlockTag) {
      return provider.getStorage(address, slot, blockTagToString(block))
    },
    async eth_getTransactionCount(address: string, block?: BlockTag) {
      return provider.getTransactionCount(address, blockTagToString(block))
    },

    async eth_call(params: { to: string; data: string; from?: string; gas?: bigint }, block?: BlockTag) {
      const tx = {
        to: params.to,
        data: params.data,
        from: params.from,
        gasLimit: params.gas,
      }
      return (provider.call as (tx: { to: string; data: string; from?: string; gasLimit?: bigint }, block?: string) => Promise<string>)(tx, blockTagToString(block))
    },
    async eth_estimateGas(params: { to?: string; from?: string; data?: string; value?: bigint }) {
      const gas = await provider.estimateGas({
        to: params.to,
        from: params.from,
        data: params.data,
        value: params.value,
      })
      return gas
    },

    async eth_gasPrice() {
      const fee = await provider.getFeeData()
      return fee.gasPrice ?? 0n
    },
    async eth_maxPriorityFeePerGas() {
      const fee = await provider.getFeeData()
      return fee.maxPriorityFeePerGas ?? 0n
    },
    async eth_feeHistory(blockCount: number, newestBlock: BlockTag, rewardPercentiles?: number[]) {
      const raw = await send<{ oldestBlock: string; baseFeePerGas: string[]; gasUsedRatio: string[]; reward?: string[][] }>(
        'eth_feeHistory',
        [blockCount, blockTagToString(newestBlock), rewardPercentiles ?? []]
      )
      return {
        oldestBlock: BigInt(raw.oldestBlock),
        baseFeePerGas: raw.baseFeePerGas.map((x) => BigInt(x)),
        gasUsedRatio: raw.gasUsedRatio.map(Number),
        reward: raw.reward?.map((arr) => arr.map((x) => BigInt(x))),
      }
    },

    async eth_getBlockByNumber(block: BlockTag, fullTransactions?: boolean) {
      const b = await (provider.getBlock as (tag: string, full?: boolean) => ReturnType<JsonRpcProvider['getBlock']>)(blockTagToString(block), fullTransactions ?? false)
      if (!b) return null
      const txList = Array.isArray(b.transactions) ? b.transactions.filter((t): t is string => typeof t === 'string') : []
      return ethersBlockToBlock({
        number: b.number,
        hash: b.hash,
        parentHash: b.parentHash,
        timestamp: b.timestamp,
        gasLimit: b.gasLimit,
        gasUsed: b.gasUsed,
        baseFeePerGas: b.baseFeePerGas,
        transactions: txList,
      })
    },
    async eth_getBlockByHash(hash: string, fullTransactions?: boolean) {
      const b = await (provider.getBlock as (tag: string, full?: boolean) => ReturnType<JsonRpcProvider['getBlock']>)(hash, fullTransactions ?? false)
      if (!b) return null
      const txList = Array.isArray(b.transactions) ? b.transactions.filter((t): t is string => typeof t === 'string') : []
      return ethersBlockToBlock({
        number: b.number,
        hash: b.hash,
        parentHash: b.parentHash,
        timestamp: b.timestamp,
        gasLimit: b.gasLimit,
        gasUsed: b.gasUsed,
        baseFeePerGas: b.baseFeePerGas,
        transactions: txList,
      })
    },

    async eth_getTransactionByHash(hash: string) {
      const tx = await provider.getTransaction(hash)
      return txResponseToTx(tx)
    },
    async eth_getTransactionReceipt(hash: string) {
      const r = await provider.getTransactionReceipt(hash)
      return receiptToReceipt(r as { blockNumber: number; blockHash: string; transactionHash?: string; hash?: string; gasUsed: bigint; status?: number | null; logs: EthersLog[] } | null)
    },

    async eth_getLogs(filter: { fromBlock?: BlockTag; toBlock?: BlockTag; address?: string | string[]; topics?: (string | string[] | null)[] }) {
      const f = {
        fromBlock: filter.fromBlock !== undefined ? blockTagToString(filter.fromBlock) : undefined,
        toBlock: filter.toBlock !== undefined ? blockTagToString(filter.toBlock) : undefined,
        address: filter.address,
        topics: filter.topics,
      }
      const logs = await provider.getLogs(f)
      return logs.map(ethersLogToLog)
    },

    async eth_getBlockTransactionCountByNumber(block: BlockTag) {
      const b = await provider.getBlock(blockTagToString(block))
      return b ? (Array.isArray(b.transactions) ? b.transactions.length : 0) : 0
    },
    async eth_getTransactionByBlockNumberAndIndex(block: BlockTag, index: number) {
      const b = await provider.getBlock(blockTagToString(block))
      if (!b || !Array.isArray(b.transactions)) return null
      const hashes = b.transactions as string[]
      const txHash = hashes?.[index]
      const tx = typeof txHash === 'string' ? await provider.getTransaction(txHash) : null
      return txResponseToTx(tx ?? null)
    },

    async eth_getUncleCountByBlockNumber(block: BlockTag) {
      return send<number>('eth_getUncleCountByBlockNumber', [blockTagToString(block)])
    },
    async eth_getUncleByBlockNumberAndIndex(block: BlockTag, index: number) {
      const raw = await send<unknown>('eth_getUncleByBlockNumberAndIndex', [blockTagToString(block), toQuantity(index)])
      if (!raw || typeof raw !== 'object') return null
      const u = raw as Record<string, unknown>
      return {
        number: BigInt(String(u.number ?? 0)),
        hash: String(u.hash ?? ''),
        parentHash: String(u.parentHash ?? ''),
        timestamp: BigInt(String(u.timestamp ?? 0)),
        gasLimit: BigInt(String(u.gasLimit ?? 0)),
        gasUsed: BigInt(String(u.gasUsed ?? 0)),
        transactions: Array.isArray(u.transactions) ? (u.transactions as string[]) : [],
      }
    },
  }

  const walletAdapter: Partial<IWeb3WalletAdapter> = {}
  if (ethereum) {
    walletAdapter.eth_requestAccounts = async () => {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts', params: [] }) as string[]
      return accounts
    }
    walletAdapter.prepareRawTransaction = async (params) => {
      const from = (await ethereum.request({ method: 'eth_requestAccounts', params: [] }) as string[])[0]
      if (!from) throw new Error('No accounts')
      const nonce = await provider.getTransactionCount(from, 'pending')
      const chainId = (await provider.getNetwork()).chainId
      const tx = EthersTx.from({
        to: params.to,
        value: params.value ?? 0n,
        data: params.data ?? '0x',
        gasLimit: params.gasLimit ?? 21000n,
        chainId,
        nonce,
        type: 2,
      })
      return { serialized: tx.unsignedSerialized, nonce }
    }
    walletAdapter.signTransaction = async (params) => {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts', params: [] }) as string[]
      const from = accounts[0]
      if (!from) throw new Error('No accounts')
      const txParams = {
        from,
        to: params.to,
        value: `0x${(params.value ?? 0n).toString(16)}`,
        data: params.data ?? '0x',
        gas: `0x${(params.gasLimit ?? 21000n).toString(16)}`,
        chainId: Number(params.chainId),
      }
      const signed = await ethereum.request({ method: 'eth_signTransaction', params: [txParams] }) as string
      return signed
    }
    walletAdapter.eth_sendRawTransaction = async (signedHex: string) => {
      const resp = await provider.broadcastTransaction(signedHex)
      return resp.hash
    }
  }

  return { ...adapter, ...walletAdapter }
}
