/**
 * Entry for bundle-size measurement only: same value imports as ethersAdapter.
 * Rollup drops unused entry exports, so we attach to globalThis as a side effect.
 */
import {
  JsonRpcProvider,
  Transaction as EthersTx,
  getBytes,
  keccak256,
  toQuantity,
} from 'ethers'

const g = globalThis as typeof globalThis & { __web3LibBundleProbe?: unknown }
g.__web3LibBundleProbe = {
  JsonRpcProvider,
  EthersTx,
  getBytes,
  keccak256,
  toQuantity,
}
