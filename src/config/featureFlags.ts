import raw from './featureFlags.json'

export type FeatureFlags = {
  /** Панель негативных сценариев (неверный RPC, смена сети в кошельке). */
  negativeTestsPanel: boolean
}

export const featureFlags: FeatureFlags = {
  negativeTestsPanel: raw.negativeTestsPanel,
}
