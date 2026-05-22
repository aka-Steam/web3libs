/**
 * Ethers adapter with thin JSON-RPC transport (one RPC per benchmark operation).
 * Use for cross-library latency comparison on equal footing with viem/web3 adapters.
 * For idiomatic Provider usage see ethersAdapter.ts (?lib=ethers).
 */
import { Transaction as EthersTx, getBytes, keccak256, toQuantity } from 'ethers'
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
import type { EIP1193Provider } from './ethersAdapter'

const blockTagToString = (block?: BlockTag): string => {
  if (block === undefined) return 'latest'
  if (typeof block === 'bigint') return toQuantity(block)
  return block
}

const toBigInt = (v: unknown): bigint => {
  if (typeof v === 'bigint') return v
  if (typeof v === 'number') return BigInt(Math.trunc(v))
  return BigInt(String(v))
}

const rawBlockToBlock = (raw: Record<string, unknown> | null): Block | null => {
  if (!raw) return null
  const txs = raw.transactions
  const txList = Array.isArray(txs)
    ? txs.map((t) => (typeof t === 'string' ? t : String((t as { hash?: string }).hash ?? '')))
    : []
  return {
    number: toBigInt(raw.number ?? 0),
    hash: String(raw.hash ?? ''),
    parentHash: String(raw.parentHash ?? ''),
    timestamp: toBigInt(raw.timestamp ?? 0),
    gasLimit: toBigInt(raw.gasLimit ?? 0),
    gasUsed: toBigInt(raw.gasUsed ?? 0),
    baseFeePerGas:
      raw.baseFeePerGas !== undefined && raw.baseFeePerGas !== null ? toBigInt(raw.baseFeePerGas) : undefined,
    transactions: txList,
  }
}

const rawTxToTx = (tx: Record<string, unknown> | null): Transaction | null => {
  if (!tx) return null
  const hash = String(tx.hash ?? '')
  if (!hash) return null
  return {
    hash,
    blockNumber: tx.blockNumber !== undefined && tx.blockNumber !== null ? toBigInt(tx.blockNumber) : undefined,
    blockHash: tx.blockHash !== undefined && tx.blockHash !== null ? String(tx.blockHash) : undefined,
    from: String(tx.from ?? ''),
    to: tx.to !== undefined && tx.to !== null && String(tx.to) !== '' ? String(tx.to) : undefined,
    value: toBigInt(tx.value ?? 0),
    gas: toBigInt(tx.gas ?? tx.gasLimit ?? 0),
    gasPrice: tx.gasPrice !== undefined && tx.gasPrice !== null ? toBigInt(tx.gasPrice) : undefined,
    input: String(tx.input ?? tx.data ?? '0x'),
    nonce: Number(toBigInt(tx.nonce ?? 0)),
  }
}

const rawReceiptToReceipt = (r: Record<string, unknown> | null): TransactionReceipt | null => {
  if (!r) return null
  const statusRaw = r.status
  const ok =
    statusRaw === true ||
    statusRaw === 1 ||
    statusRaw === 1n ||
    String(statusRaw) === '1' ||
    String(statusRaw) === '0x1'
  const logsRaw = r.logs
  const logs: Log[] = Array.isArray(logsRaw)
    ? logsRaw.map((l) => {
        const log = l as Record<string, unknown>
        return {
          address: String(log.address ?? ''),
          topics: (log.topics as string[]) ?? [],
          data: String(log.data ?? '0x'),
          blockNumber: toBigInt(log.blockNumber ?? 0),
          transactionHash: String(log.transactionHash ?? ''),
        }
      })
    : []
  return {
    blockNumber: toBigInt(r.blockNumber ?? 0),
    blockHash: String(r.blockHash ?? ''),
    transactionHash: String(r.transactionHash ?? r.hash ?? ''),
    gasUsed: toBigInt(r.gasUsed ?? 0),
    status: ok ? 'success' : 'reverted',
    logs,
  }
}

const rawLogToLog = (l: Record<string, unknown>): Log => ({
  address: String(l.address ?? ''),
  topics: (l.topics as string[]) ?? [],
  data: String(l.data ?? '0x'),
  blockNumber: toBigInt(l.blockNumber ?? 0),
  transactionHash: String(l.transactionHash ?? ''),
})

export interface EthersRpcAdapterOptions {
  rpcUrl: string
  ethereum?: EIP1193Provider
}

export function createEthersRpcAdapter(options: EthersRpcAdapterOptions): Web3Adapter {
  const { rpcUrl, ethereum } = options
  let rpcRequestId = 1

  const send = async <T>(method: string, params: unknown[] = []): Promise<T> => {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: rpcRequestId++,
        method,
        params,
      }),
    })
    const json = (await response.json()) as {
      result?: T
      error?: { message: string; code?: number }
    }
    if (json.error) {
      const err = new Error(json.error.message)
      ;(err as Error & { code?: number }).code = json.error.code
      throw err
    }
    return json.result as T
  }

  const adapter: IWeb3Adapter = {
    libId: 'ethers-rpc',

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
      const hex = await send<string>('eth_chainId', [])
      return BigInt(hex)
    },
    async eth_syncing() {
      return send<boolean | object>('eth_syncing', [])
    },
    async eth_blockNumber() {
      const hex = await send<string>('eth_blockNumber', [])
      return BigInt(hex)
    },

    async eth_getBalance(address: string, block?: BlockTag) {
      const hex = await send<string>('eth_getBalance', [address, blockTagToString(block)])
      return BigInt(hex)
    },
    async eth_getCode(address: string, block?: BlockTag) {
      const code = await send<string>('eth_getCode', [address, blockTagToString(block)])
      return code ?? '0x'
    },
    async eth_getStorageAt(address: string, slot: string, block?: BlockTag) {
      const value = await send<string>('eth_getStorageAt', [address, slot, blockTagToString(block)])
      return value ?? '0x'
    },
    async eth_getTransactionCount(address: string, block?: BlockTag) {
      const hex = await send<string>('eth_getTransactionCount', [address, blockTagToString(block)])
      return Number(BigInt(hex))
    },

    async eth_call(params: { to: string; data: string; from?: string; gas?: bigint }, block?: BlockTag) {
      const tx: Record<string, unknown> = {
        to: params.to,
        data: params.data,
      }
      if (params.from !== undefined) tx.from = params.from
      if (params.gas !== undefined) tx.gas = toQuantity(params.gas)
      return send<string>('eth_call', [tx, blockTagToString(block)])
    },
    async eth_estimateGas(params: { to?: string; from?: string; data?: string; value?: bigint }) {
      const tx: Record<string, unknown> = {}
      if (params.to !== undefined) tx.to = params.to
      if (params.from !== undefined) tx.from = params.from
      if (params.data !== undefined) tx.data = params.data
      if (params.value !== undefined) tx.value = toQuantity(params.value)
      const hex = await send<string>('eth_estimateGas', [tx])
      return BigInt(hex)
    },

    async eth_gasPrice() {
      const hex = await send<string>('eth_gasPrice', [])
      return BigInt(hex)
    },
    async eth_maxPriorityFeePerGas() {
      const hex = await send<string>('eth_maxPriorityFeePerGas', [])
      return BigInt(hex)
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
      const raw = await send<Record<string, unknown> | null>('eth_getBlockByNumber', [
        blockTagToString(block),
        fullTransactions ?? false,
      ])
      return rawBlockToBlock(raw)
    },
    async eth_getBlockByHash(hash: string, fullTransactions?: boolean) {
      const raw = await send<Record<string, unknown> | null>('eth_getBlockByHash', [hash, fullTransactions ?? false])
      return rawBlockToBlock(raw)
    },

    async eth_getTransactionByHash(hash: string) {
      const raw = await send<Record<string, unknown> | null>('eth_getTransactionByHash', [hash])
      return rawTxToTx(raw)
    },
    async eth_getTransactionReceipt(hash: string) {
      const raw = await send<Record<string, unknown> | null>('eth_getTransactionReceipt', [hash])
      return rawReceiptToReceipt(raw)
    },

    async eth_getLogs(filter: { fromBlock?: BlockTag; toBlock?: BlockTag; address?: string | string[]; topics?: (string | string[] | null)[] }) {
      const f: Record<string, unknown> = {}
      if (filter.fromBlock !== undefined) f.fromBlock = blockTagToString(filter.fromBlock)
      if (filter.toBlock !== undefined) f.toBlock = blockTagToString(filter.toBlock)
      if (filter.address !== undefined) f.address = filter.address
      if (filter.topics?.length) f.topics = filter.topics
      const logs = await send<Record<string, unknown>[]>('eth_getLogs', [f])
      return (logs ?? []).map(rawLogToLog)
    },

    async eth_getBlockTransactionCountByNumber(block: BlockTag) {
      const hex = await send<string>('eth_getBlockTransactionCountByNumber', [blockTagToString(block)])
      return Number.parseInt(hex, 16)
    },
    async eth_getTransactionByBlockNumberAndIndex(block: BlockTag, index: number) {
      const raw = await send<Record<string, unknown> | null>('eth_getTransactionByBlockNumberAndIndex', [
        blockTagToString(block),
        toQuantity(index),
      ])
      return rawTxToTx(raw)
    },

    async eth_getUncleCountByBlockNumber(block: BlockTag) {
      const hex = await send<string>('eth_getUncleCountByBlockNumber', [blockTagToString(block)])
      return Number.parseInt(hex, 16)
    },
    async eth_getUncleByBlockNumberAndIndex(block: BlockTag, index: number) {
      const raw = await send<Record<string, unknown> | null>('eth_getUncleByBlockNumberAndIndex', [
        blockTagToString(block),
        toQuantity(index),
      ])
      if (!raw) return null
      return {
        number: toBigInt(raw.number ?? 0),
        hash: String(raw.hash ?? ''),
        parentHash: String(raw.parentHash ?? ''),
        timestamp: toBigInt(raw.timestamp ?? 0),
        gasLimit: toBigInt(raw.gasLimit ?? 0),
        gasUsed: toBigInt(raw.gasUsed ?? 0),
        transactions: Array.isArray(raw.transactions) ? (raw.transactions as string[]) : [],
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
      const nonceHex = await send<string>('eth_getTransactionCount', [from, 'pending'])
      const nonce = Number(BigInt(nonceHex))
      const chainIdHex = await send<string>('eth_chainId', [])
      const chainId = BigInt(chainIdHex)
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
      return send<string>('eth_sendRawTransaction', [signedHex])
    }
    walletAdapter.eth_sendTransaction = async (params) => {
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
      const hash = await ethereum.request({ method: 'eth_sendTransaction', params: [txParams] }) as string
      return hash
    }
  }

  return { ...adapter, ...walletAdapter }
}
