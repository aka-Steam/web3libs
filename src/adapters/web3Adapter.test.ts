import { describe, expect, it } from 'vitest'
import { keccak256, hexToBytes } from 'web3-utils'
import { createWeb3Adapter } from './web3Adapter'

describe('createWeb3Adapter', () => {
  it('web3_sha3 matches local keccak256(hex) without hitting RPC', async () => {
    const adapter = createWeb3Adapter({ rpcUrl: 'http://127.0.0.1:59999' })
    const data = '0x68656c6c6f'
    const got = await adapter.web3_sha3(data)
    const want = keccak256(hexToBytes(data as `0x${string}`))
    expect(got).toBe(want)
  })

  it('exposes libId web3', () => {
    const adapter = createWeb3Adapter({ rpcUrl: 'http://127.0.0.1:59999' })
    expect(adapter.libId).toBe('web3')
  })
})

describe('createWeb3Adapter RPC integration', () => {
  const url = process.env.RPC_URL ?? 'http://127.0.0.1:8545'
  const run = process.env.RPC_INTEGRATION === '1'

  it.skipIf(!run)('eth_chainId against local node (set RPC_INTEGRATION=1 and start Anvil)', async () => {
    const adapter = createWeb3Adapter({ rpcUrl: url })
    const id = await adapter.eth_chainId()
    expect(id).toBeGreaterThan(0n)
  })
})
