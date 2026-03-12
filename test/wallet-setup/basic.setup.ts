/**
 * Synpress wallet setup: seed phrase, password.
 * Anvil network добавляется при подключении dApp (wallet_addEthereumChain) или вручную.
 * Run on Linux: npx synpress (build wallet cache), then npx playwright test e2e/benchmark-wallet.spec.ts
 */
import { defineWalletSetup } from '@synthetixio/synpress'
import { MetaMask } from '@synthetixio/synpress/playwright'

const SEED_PHRASE = 'test test test test test test test test test test test junk'
export const WALLET_PASSWORD = 'Password123'

export default defineWalletSetup(WALLET_PASSWORD, async (context, walletPage) => {
  const metamask = new MetaMask(context, walletPage, WALLET_PASSWORD)
  await metamask.importWallet(SEED_PHRASE)
})

