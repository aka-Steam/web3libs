import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  keccak256,
  toHex,
  serializeTransaction,
  type Block as ViemBlock,
  type Log as ViemLog,
  type TransactionReceipt as ViemReceipt,
  type GetTransactionReturnType,
} from 'viem'
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

const blockTagToViem = (block?: BlockTag): 'latest' | 'earliest' | 'pending' | bigint => {
  if (block === undefined) return 'latest'
  if (typeof block === 'bigint') return block
  return block
}

const viemBlockToBlock = (b: ViemBlock | null): Block | null => {
  if (!b) return null
  const txList = b.transactions?.map((t) => (typeof t === 'string' ? t : t.hash)) ?? []
  return {
    number: b.number ?? 0n,
    hash: b.hash ?? '',
    parentHash: b.parentHash,
    timestamp: b.timestamp,
    gasLimit: b.gasLimit,
    gasUsed: b.gasUsed,
    baseFeePerGas: b.baseFeePerGas ?? undefined,
    transactions: txList,
  }
}

const viemTxToTx = (tx: GetTransactionReturnType | null): Transaction | null => {
  if (!tx) return null
  return {
    hash: tx.hash,
    blockNumber: tx.blockNumber,
    blockHash: tx.blockHash,
    from: tx.from,
    to: tx.to ?? undefined,
    value: tx.value,
    gas: tx.gas ?? 0n,
    gasPrice: tx.gasPrice ?? undefined,
    input: tx.input,
    nonce: tx.nonce,
  }
}

const viemReceiptToReceipt = (r: ViemReceipt | null): TransactionReceipt | null => {
  if (!r) return null
  return {
    blockNumber: r.blockNumber,
    blockHash: r.blockHash,
    transactionHash: r.transactionHash,
    gasUsed: r.gasUsed,
    status: r.status === 'success' ? 'success' : 'reverted',
    logs: r.logs.map((l) => ({
      address: l.address,
      topics: l.topics as string[],
      data: l.data,
      blockNumber: l.blockNumber,
      transactionHash: l.transactionHash ?? '',
    })),
  }
}

const viemLogToLog = (l: ViemLog): Log => ({
  address: l.address,
  topics: l.topics as string[],
  data: l.data,
  blockNumber: l.blockNumber ?? 0n,
  transactionHash: l.transactionHash ?? '',
})

export interface ViemAdapterOptions {
  rpcUrl: string
  ethereum?: EIP1193Provider
}

export interface EIP1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
}

export function createViemAdapter(options: ViemAdapterOptions): Web3Adapter {
  const { rpcUrl, ethereum } = options
  const transport = http(rpcUrl)
  const client = createPublicClient({ transport })

  const request = async <T>(method: string, params: unknown[] = []): Promise<T> => {
    return client.request({ method, params } as any) as Promise<T>
  }

  const adapter: IWeb3Adapter = {
    libId: 'viem',

    async web3_clientVersion() {
      return request<string>('web3_clientVersion', [])
    },
    async web3_sha3(data: string) {
      return keccak256(new TextEncoder().encode(data))
    },

    async net_version() {
      return request<string>('net_version', [])
    },
    async net_peerCount() {
      const hex = await request<string>('net_peerCount', [])
      return BigInt(hex)
    },
    async net_listening() {
      return request<boolean>('net_listening', [])
    },

    async eth_chainId() {
      return BigInt(await client.getChainId())
    },
    async eth_syncing() {
      return request<boolean | object>('eth_syncing', [])
    },
    async eth_blockNumber() {
      const n = await client.getBlockNumber()
      return BigInt(n)
    },

    async eth_getBalance(address: string, block?: BlockTag) {
      const tag = blockTagToViem(block)
      if (typeof tag === 'bigint') return client.getBalance({ address: address as `0x${string}`, blockNumber: tag })
      return client.getBalance({ address: address as `0x${string}`, blockTag: tag })
    },
    async eth_getCode(address: string, block?: BlockTag) {
      const tag = blockTagToViem(block)
      const code = typeof tag === 'bigint'
        ? await client.getCode({ address: address as `0x${string}`, blockNumber: tag })
        : await client.getCode({ address: address as `0x${string}`, blockTag: tag })
      return code ?? '0x'
    },
    async eth_getStorageAt(address: string, slot: string, block?: BlockTag) {
      const tag = blockTagToViem(block)
      const value = typeof tag === 'bigint'
        ? await client.getStorageAt({ address: address as `0x${string}`, slot: slot as `0x${string}`, blockNumber: tag })
        : await client.getStorageAt({ address: address as `0x${string}`, slot: slot as `0x${string}`, blockTag: tag })
      return value ?? '0x'
    },
    async eth_getTransactionCount(address: string, block?: BlockTag) {
      const tag = blockTagToViem(block)
      if (typeof tag === 'bigint') return client.getTransactionCount({ address: address as `0x${string}`, blockNumber: tag })
      return client.getTransactionCount({ address: address as `0x${string}`, blockTag: tag })
    },

    async eth_call(params: { to: string; data: string; from?: string; gas?: bigint }, block?: BlockTag) {
      const tag = blockTagToViem(block)
      const opts: Parameters<typeof client.call>[0] = {
        to: params.to as `0x${string}`,
        data: params.data as `0x${string}`,
        gas: params.gas,
      }
      if (typeof tag === 'bigint') opts.blockNumber = tag
      else opts.blockTag = tag
      if (params.from) opts.account = params.from as `0x${string}`
      const r = await client.call(opts)
      return r.data ?? '0x'
    },
    async eth_estimateGas(params: { to?: string; from?: string; data?: string; value?: bigint }) {
      const opts: any = { to: params.to, data: params.data, value: params.value }
      if (params.from) opts.account = params.from
      return client.estimateGas(opts)
    },

    async eth_gasPrice() {
      return client.getGasPrice()
    },
    async eth_maxPriorityFeePerGas() {
      return (client as any).getMaxPriorityFeePerGas?.() ?? request<string>('eth_maxPriorityFeePerGas', []).then((x) => BigInt(x))
    },
    async eth_feeHistory(blockCount: number, newestBlock: BlockTag, rewardPercentiles?: number[]) {
      const tag = blockTagToViem(newestBlock)
      const blockArg = typeof tag === 'bigint' ? toHex(tag) : tag
      const raw = await request<{ oldestBlock: string; baseFeePerGas: string[]; gasUsedRatio: string[]; reward?: string[][] }>(
        'eth_feeHistory',
        [blockCount, blockArg, rewardPercentiles ?? []]
      )
      return {
        oldestBlock: BigInt(raw.oldestBlock),
        baseFeePerGas: raw.baseFeePerGas.map((x) => BigInt(x)),
        gasUsedRatio: raw.gasUsedRatio.map(Number),
        reward: raw.reward?.map((arr) => arr.map((x) => BigInt(x))),
      }
    },

    async eth_getBlockByNumber(block: BlockTag, fullTransactions?: boolean) {
      const tag = blockTagToViem(block)
      const b = typeof tag === 'bigint'
        ? await client.getBlock({ blockNumber: tag, includeTransactions: fullTransactions ?? false })
        : await client.getBlock({ blockTag: tag, includeTransactions: fullTransactions ?? false })
      return viemBlockToBlock(b)
    },
    async eth_getBlockByHash(hash: string, fullTransactions?: boolean) {
      const b = await client.getBlock({ blockHash: hash as `0x${string}`, includeTransactions: fullTransactions ?? false })
      return viemBlockToBlock(b)
    },

    async eth_getTransactionByHash(hash: string) {
      const tx = await client.getTransaction({ hash: hash as `0x${string}` })
      return viemTxToTx(tx)
    },
    async eth_getTransactionReceipt(hash: string) {
      const r = await client.getTransactionReceipt({ hash: hash as `0x${string}` })
      return viemReceiptToReceipt(r)
    },

    async eth_getLogs(filter: { fromBlock?: BlockTag; toBlock?: BlockTag; address?: string | string[]; topics?: (string | string[] | null)[] }) {
      const opts: any = { address: filter.address }
      if (filter.fromBlock !== undefined) {
        const t = blockTagToViem(filter.fromBlock)
        if (typeof t === 'bigint') opts.fromBlock = t
        else opts.fromBlock = t
      }
      if (filter.toBlock !== undefined) {
        const t = blockTagToViem(filter.toBlock)
        if (typeof t === 'bigint') opts.toBlock = t
        else opts.toBlock = t
      }
      if (filter.topics?.length) opts.topics = filter.topics
      const logs = await client.getLogs(opts)
      return logs.map(viemLogToLog)
    },

    async eth_getBlockTransactionCountByNumber(block: BlockTag) {
      const tag = blockTagToViem(block)
      const b = typeof tag === 'bigint' ? await client.getBlock({ blockNumber: tag }) : await client.getBlock({ blockTag: tag })
      return b?.transactions?.length ?? 0
    },
    async eth_getTransactionByBlockNumberAndIndex(block: BlockTag, index: number) {
      const tag = blockTagToViem(block)
      const b = typeof tag === 'bigint'
        ? await client.getBlock({ blockNumber: tag, includeTransactions: true })
        : await client.getBlock({ blockTag: tag, includeTransactions: true })
      if (!b?.transactions?.length) return null
      const tx = b.transactions[index]
      const txObj = typeof tx === 'object' && tx !== null && 'hash' in tx ? tx : null
      return txObj ? viemTxToTx(txObj as GetTransactionReturnType) : null
    },

    async eth_getUncleCountByBlockNumber(block: BlockTag) {
      const tag = blockTagToViem(block)
      const hex = await request<string>('eth_getUncleCountByBlockNumber', [typeof tag === 'bigint' ? toHex(tag) : tag])
      return parseInt(hex, 16)
    },
    async eth_getUncleByBlockNumberAndIndex(block: BlockTag, index: number) {
      const tag = blockTagToViem(block)
      const raw = await request<Record<string, unknown> | null>('eth_getUncleByBlockNumberAndIndex', [typeof tag === 'bigint' ? toHex(tag) : tag, toHex(index)])
      if (!raw) return null
      return {
        number: BigInt(String(raw.number ?? 0)),
        hash: String(raw.hash ?? ''),
        parentHash: String(raw.parentHash ?? ''),
        timestamp: BigInt(String(raw.timestamp ?? 0)),
        gasLimit: BigInt(String(raw.gasLimit ?? 0)),
        gasUsed: BigInt(String(raw.gasUsed ?? 0)),
        transactions: Array.isArray(raw.transactions) ? (raw.transactions as string[]) : [],
      }
    },
  }

  const walletAdapter: Partial<IWeb3WalletAdapter> = {}
  if (ethereum) {
    const walletClient = createWalletClient({ transport: custom(ethereum as any) })
    walletAdapter.eth_requestAccounts = async () => {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts', params: [] }) as string[]
      return accounts
    }
    walletAdapter.prepareRawTransaction = async (params) => {
      const [account] = (await walletClient.getAddresses()) ?? []
      if (!account) throw new Error('No accounts')
      const nonce = await client.getTransactionCount({ address: account, blockTag: 'pending' })
      const chainId = await client.getChainId()
      const txRequest = await walletClient.prepareTransactionRequest({
        account,
        to: params.to as `0x${string}`,
        value: params.value ?? 0n,
        data: (params.data ?? '0x') as `0x${string}`,
        gas: params.gasLimit ?? 21000n,
        chainId,
        nonce,
      } as any)
      const unsigned = serializeTransaction(txRequest)
      return { serialized: unsigned, nonce }
    }
    walletAdapter.signTransaction = async (params) => {
      const [account] = (await walletClient.getAddresses()) ?? []
      if (!account) throw new Error('No accounts')
      const txParams = {
        from: account,
        to: params.to as `0x${string}`,
        value: `0x${(params.value ?? 0n).toString(16)}`,
        data: params.data ?? '0x',
        gas: `0x${(params.gasLimit ?? 21000n).toString(16)}`,
        chainId: Number(params.chainId),
      }
      const signed = await (ethereum.request({ method: 'eth_signTransaction', params: [txParams] }) as Promise<string>)
      return signed
    }
    walletAdapter.eth_sendRawTransaction = async (signedHex: string) => {
      return request<string>('eth_sendRawTransaction', [signedHex])
    }
  }

  return { ...adapter, ...walletAdapter }
}
