/**
 * Synpress wallet setup: seed phrase, password, Anvil network.
 * Run on Linux: npx synpress (build wallet cache), then npx playwright test
 */
import { defineWalletSetup } from '@synthetixio/synpress'

const SEED_PHRASE = 'test test test test test test test test test test test junk'
const WALLET_PASSWORD = 'Password123'

const ANVIL_NETWORK = {
  name: 'Anvil Local',
  rpcUrl: 'http://127.0.0.1:8545',
  chainId: 31337,
  symbol: 'ETH',
}

export default defineWalletSetup(WALLET_PASSWORD, async ({ context, walletPage, extensionId }) => {
  const { MetaMask } = await import('@synthetixio/synpress/playwright')
  const metamask = new MetaMask(context, walletPage, WALLET_PASSWORD, extensionId)
  await metamask.addNetwork({
    name: ANVIL_NETWORK.name,
    rpcUrl: ANVIL_NETWORK.rpcUrl,
    chainId: ANVIL_NETWORK.chainId,
    symbol: ANVIL_NETWORK.symbol,
  })
})

export const walletPassword = WALLET_PASSWORD
export const seedPhrase = SEED_PHRASE
