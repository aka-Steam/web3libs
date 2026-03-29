import { Web3 } from 'web3'
import { TransactionFactory } from 'web3-eth-accounts'
import { bytesToHex, hexToBytes, keccak256, toHex } from 'web3-utils'
import type { BlockNumberOrTag } from 'web3-types'
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

export interface Web3AdapterOptions {
  rpcUrl: string
  ethereum?: EIP1193Provider
}

export interface EIP1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
}

const blockTagToWeb3 = (block?: BlockTag): BlockNumberOrTag => {
  if (block === undefined) return 'latest'
  if (typeof block === 'bigint') return block
  return block
}

const filterBlockTag = (tag?: BlockTag): BlockNumberOrTag | undefined => {
  if (tag === undefined) return undefined
  return blockTagToWeb3(tag)
}

const toBigInt = (v: unknown): bigint => {
  if (typeof v === 'bigint') return v
  if (typeof v === 'number') return BigInt(Math.trunc(v))
  return BigInt(String(v))
}

const web3BlockToBlock = (b: Record<string, unknown> | null | undefined): Block | null => {
  if (!b) return null
  const txs = b.transactions
  const txList = Array.isArray(txs)
    ? txs.map((t) => (typeof t === 'string' ? t : String((t as { hash?: string }).hash ?? '')))
    : []
  return {
    number: toBigInt(b.number ?? 0),
    hash: String(b.hash ?? ''),
    parentHash: String(b.parentHash ?? ''),
    timestamp: toBigInt(b.timestamp ?? 0),
    gasLimit: toBigInt(b.gasLimit ?? 0),
    gasUsed: toBigInt(b.gasUsed ?? 0),
    baseFeePerGas: b.baseFeePerGas !== undefined && b.baseFeePerGas !== null ? toBigInt(b.baseFeePerGas) : undefined,
    transactions: txList,
  }
}

const web3TxToTx = (tx: Record<string, unknown> | null | undefined): Transaction | null => {
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

const web3ReceiptToReceipt = (r: Record<string, unknown> | null | undefined): TransactionReceipt | null => {
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

const web3LogToLog = (l: Record<string, unknown>): Log => ({
  address: String(l.address ?? ''),
  topics: (l.topics as string[]) ?? [],
  data: String(l.data ?? '0x'),
  blockNumber: toBigInt(l.blockNumber ?? 0),
  transactionHash: String(l.transactionHash ?? ''),
})

export function createWeb3Adapter(options: Web3AdapterOptions): Web3Adapter {
  const { rpcUrl, ethereum } = options
  const web3 = new Web3(rpcUrl)
  const eth = web3.eth

  const send = async <T>(method: string, params: readonly unknown[] = []): Promise<T> => {
    return eth.requestManager.send({ method, params: [...params] } as Parameters<typeof eth.requestManager.send>[0]) as Promise<T>
  }

  const adapter: IWeb3Adapter = {
    libId: 'web3',

    async web3_clientVersion() {
      return send<string>('web3_clientVersion', [])
    },
    async web3_sha3(data: string) {
      const bytes = hexToBytes(data as `0x${string}`)
      return keccak256(bytes)
    },

    async net_version() {
      const id = await eth.net.getId()
      return String(id)
    },
    async net_peerCount() {
      return eth.net.getPeerCount()
    },
    async net_listening() {
      return eth.net.isListening()
    },

    async eth_chainId() {
      return eth.getChainId()
    },
    async eth_syncing() {
      const s = await eth.isSyncing()
      if (s === false) return false
      return s as object
    },
    async eth_blockNumber() {
      return eth.getBlockNumber()
    },

    async eth_getBalance(address: string, block?: BlockTag) {
      return eth.getBalance(address, blockTagToWeb3(block))
    },
    async eth_getCode(address: string, block?: BlockTag) {
      const c = await eth.getCode(address, blockTagToWeb3(block))
      return c ?? '0x'
    },
    async eth_getStorageAt(address: string, slot: string, block?: BlockTag) {
      const v = await eth.getStorageAt(address, slot, blockTagToWeb3(block))
      return v ?? '0x'
    },
    async eth_getTransactionCount(address: string, block?: BlockTag) {
      const n = await eth.getTransactionCount(address, blockTagToWeb3(block))
      return Number(n)
    },

    async eth_call(params: { to: string; data: string; from?: string; gas?: bigint }, block?: BlockTag) {
      const tx = {
        to: params.to,
        data: params.data,
        gas: params.gas,
        ...(params.from ? { from: params.from } : {}),
      }
      const out = await eth.call(tx, blockTagToWeb3(block))
      return typeof out === 'string' ? out : String(out)
    },
    async eth_estimateGas(params: { to?: string; from?: string; data?: string; value?: bigint }) {
      const tx: Record<string, unknown> = {}
      if (params.to !== undefined) tx.to = params.to
      if (params.from !== undefined) tx.from = params.from
      if (params.data !== undefined) tx.data = params.data
      if (params.value !== undefined) tx.value = params.value
      return eth.estimateGas(tx)
    },

    async eth_gasPrice() {
      return eth.getGasPrice()
    },
    async eth_maxPriorityFeePerGas() {
      return eth.getMaxPriorityFeePerGas()
    },
    async eth_feeHistory(blockCount: number, newestBlock: BlockTag, rewardPercentiles?: number[]) {
      const h = await eth.getFeeHistory(blockCount, blockTagToWeb3(newestBlock), rewardPercentiles ?? [])
      return {
        oldestBlock: toBigInt(h.oldestBlock),
        baseFeePerGas: h.baseFeePerGas.map((x) => toBigInt(x)),
        gasUsedRatio: h.gasUsedRatio.map((x) => Number(x)),
        reward: h.reward?.map((arr) => arr.map((x) => toBigInt(x))),
      }
    },

    async eth_getBlockByNumber(block: BlockTag, fullTransactions?: boolean) {
      const b = await eth.getBlock(blockTagToWeb3(block), fullTransactions ?? false)
      return web3BlockToBlock(b as unknown as Record<string, unknown> | null)
    },
    async eth_getBlockByHash(hash: string, fullTransactions?: boolean) {
      const b = await eth.getBlock(hash, fullTransactions ?? false)
      return web3BlockToBlock(b as unknown as Record<string, unknown> | null)
    },

    async eth_getTransactionByHash(hash: string) {
      const tx = await eth.getTransaction(hash)
      return web3TxToTx(tx as unknown as Record<string, unknown> | null)
    },
    async eth_getTransactionReceipt(hash: string) {
      const r = await eth.getTransactionReceipt(hash)
      return web3ReceiptToReceipt(r as unknown as Record<string, unknown> | null)
    },

    async eth_getLogs(filter: {
      fromBlock?: BlockTag
      toBlock?: BlockTag
      address?: string | string[]
      topics?: (string | string[] | null)[]
    }) {
      const f: Record<string, unknown> = {}
      const fb = filterBlockTag(filter.fromBlock)
      const tb = filterBlockTag(filter.toBlock)
      if (fb !== undefined) f.fromBlock = fb
      if (tb !== undefined) f.toBlock = tb
      if (filter.address !== undefined) f.address = filter.address
      if (filter.topics?.length) f.topics = filter.topics
      const logs = await eth.getPastLogs(f)
      return (logs as unknown as Record<string, unknown>[]).map(web3LogToLog)
    },

    async eth_getBlockTransactionCountByNumber(block: BlockTag) {
      const b = await eth.getBlock(blockTagToWeb3(block), false)
      const txs = b?.transactions
      return Array.isArray(txs) ? txs.length : 0
    },
    async eth_getTransactionByBlockNumberAndIndex(block: BlockTag, index: number) {
      const b = await eth.getBlock(blockTagToWeb3(block), true)
      const txs = b?.transactions
      if (!Array.isArray(txs) || !txs.length) return null
      const entry = txs[index]
      if (typeof entry === 'string') {
        const tx = await eth.getTransaction(entry)
        return web3TxToTx(tx as unknown as Record<string, unknown> | null)
      }
      return web3TxToTx(entry as unknown as Record<string, unknown>)
    },

    async eth_getUncleCountByBlockNumber(block: BlockTag) {
      const tag = blockTagToWeb3(block)
      const hex = await send<string>('eth_getUncleCountByBlockNumber', [typeof tag === 'bigint' ? toHex(tag) : tag])
      return Number.parseInt(hex, 16)
    },
    async eth_getUncleByBlockNumberAndIndex(block: BlockTag, index: number) {
      const tag = blockTagToWeb3(block)
      const raw = await send<Record<string, unknown> | null>('eth_getUncleByBlockNumberAndIndex', [
        typeof tag === 'bigint' ? toHex(tag) : tag,
        toHex(index),
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
      return ethereum.request({ method: 'eth_requestAccounts', params: [] }) as Promise<string[]>
    }
    walletAdapter.prepareRawTransaction = async (params) => {
      const accounts = (await ethereum.request({ method: 'eth_requestAccounts', params: [] })) as string[]
      const from = accounts[0]
      if (!from) throw new Error('No accounts')
      const nonce = await eth.getTransactionCount(from, 'pending')
      const pending = await eth.getBlock('pending')
      const baseFee = pending.baseFeePerGas ?? 0n
      const priority = await eth.getMaxPriorityFeePerGas()
      const maxFee = baseFee * 2n + priority
      const tx = TransactionFactory.fromTxData({
        type: 2,
        to: params.to,
        value: params.value ?? 0n,
        data: hexToBytes((params.data ?? '0x') as `0x${string}`),
        gasLimit: params.gasLimit ?? 21000n,
        chainId: params.chainId,
        nonce,
        maxFeePerGas: maxFee,
        maxPriorityFeePerGas: priority,
      })
      const serialized = bytesToHex(tx.serialize())
      return { serialized, nonce: Number(nonce) }
    }
    walletAdapter.signTransaction = async (params) => {
      const accounts = (await ethereum.request({ method: 'eth_requestAccounts', params: [] })) as string[]
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
      return ethereum.request({ method: 'eth_signTransaction', params: [txParams] }) as Promise<string>
    }
    walletAdapter.eth_sendRawTransaction = async (signedHex: string) => {
      return send<string>('eth_sendRawTransaction', [signedHex])
    }
  }

  return { ...adapter, ...walletAdapter }
}
