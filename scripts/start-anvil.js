#!/usr/bin/env node
/**
 * Start Anvil (Foundry) local chain.
 * Requires: foundry (forge, anvil) installed.
 * On Windows: run "anvil" manually or use WSL if npm script fails.
 */
import { spawn } from 'child_process'

const anvil = spawn('anvil', [], {
  stdio: 'inherit',
  shell: true,
})

anvil.on('error', (err) => {
  console.error('Failed to start Anvil. Is Foundry installed? Run: curl -L https://foundry.paradigm.xyz | bash')
  process.exit(1)
})

anvil.on('exit', (code) => {
  process.exit(code ?? 0)
})
