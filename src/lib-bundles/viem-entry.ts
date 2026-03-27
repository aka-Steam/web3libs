/**
 * Entry for bundle-size measurement only: same value imports as viemAdapter.
 * Types from viem are compile-time only and do not affect JS bundle size.
 */
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  keccak256,
  toHex,
  serializeTransaction,
} from 'viem'

const g = globalThis as typeof globalThis & { __web3LibBundleProbe?: unknown }
g.__web3LibBundleProbe = {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  keccak256,
  toHex,
  serializeTransaction,
}
