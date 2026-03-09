import { useState } from 'react'
import { useWeb3Adapter } from '../context/Web3AdapterContext'

export function NegativeTestsPanel() {
  const { adapter, libId } = useWeb3Adapter()
  const [wrongRpcError, setWrongRpcError] = useState<string | null>(null)
  const [switchChainResult, setSwitchChainResult] = useState<string | null>(null)

  const runWrongRpc = async () => {
    setWrongRpcError(null)
    if (!adapter) return
    const badUrl = 'http://127.0.0.1:9999'
    try {
      if (libId === 'ethers') {
        const { createEthersAdapter } = await import('../adapters/ethersAdapter')
        const badAdapter = createEthersAdapter({ rpcUrl: badUrl })
        await badAdapter.eth_blockNumber()
      } else {
        const { createViemAdapter } = await import('../adapters/viemAdapter')
        const badAdapter = createViemAdapter({ rpcUrl: badUrl })
        await badAdapter.eth_blockNumber()
      }
    } catch (e) {
      setWrongRpcError(e instanceof Error ? e.message : String(e))
    }
  }

  const runSwitchChain = async () => {
    setSwitchChainResult(null)
    const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum
    if (!ethereum) {
      setSwitchChainResult('No wallet (window.ethereum)')
      return
    }
    try {
      await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x7a69' }] })
      setSwitchChainResult('Switched to Anvil (31337)')
    } catch (e) {
      setSwitchChainResult(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <section style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid #ccc', borderRadius: 8 }}>
      <h2>Negative / reliability scenarios</h2>
      <p style={{ fontSize: '0.9rem', color: '#666' }}>
        Capture error messages for reporting. «Обрыв сети»: stop Anvil, then run benchmark.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div>
          <button type="button" onClick={runWrongRpc} data-testid="negative-wrong-rpc">
            Wrong RPC URL (http://127.0.0.1:9999)
          </button>
          {wrongRpcError != null && (
            <pre style={{ marginTop: 4, padding: 8, background: '#f5f5f5', fontSize: 12, overflow: 'auto' }} data-testid="negative-wrong-rpc-error">
              {wrongRpcError}
            </pre>
          )}
        </div>
        <div>
          <button type="button" onClick={runSwitchChain} data-testid="negative-switch-chain">
            Switch chain (wallet_switchEthereumChain to Anvil)
          </button>
          {switchChainResult != null && (
            <pre style={{ marginTop: 4, padding: 8, background: '#f5f5f5', fontSize: 12 }} data-testid="negative-switch-chain-result">
              {switchChainResult}
            </pre>
          )}
        </div>
      </div>
    </section>
  )
}
