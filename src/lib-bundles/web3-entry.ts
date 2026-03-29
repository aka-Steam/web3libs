/**
 * Entry for bundle-size measurement: same value imports as web3Adapter (Web3 stack).
 */
import { Web3 } from 'web3'
import { TransactionFactory } from 'web3-eth-accounts'
import { bytesToHex, hexToBytes, keccak256, toHex } from 'web3-utils'

const g = globalThis as typeof globalThis & { __web3LibBundleProbe?: unknown }
g.__web3LibBundleProbe = {
  Web3,
  TransactionFactory,
  bytesToHex,
  hexToBytes,
  keccak256,
  toHex,
}
