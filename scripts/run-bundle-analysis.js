import { build } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

async function buildWithConfig(outDir, inputHtml) {
  await build({
    root,
    plugins: [react()],
    build: {
      outDir,
      rollupOptions: { input: inputHtml },
    },
  })
}

function getSize(filePath) {
  const raw = fs.readFileSync(filePath)
  const gzip = zlib.gzipSync(raw)
  const brotli = zlib.brotliCompressSync(raw)
  return { raw: raw.length, gzip: gzip.length, brotli: brotli.length }
}

function findJsAssets(dir) {
  const assetsDir = path.join(dir, 'assets')
  if (!fs.existsSync(assetsDir)) return []
  return fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'))
}

async function main() {
  console.log('Building ethers bundle...')
  await buildWithConfig('dist-ethers', path.join(root, 'index-ethers.html'))
  console.log('Building viem bundle...')
  await buildWithConfig('dist-viem', path.join(root, 'index-viem.html'))

  const results = {}
  for (const name of ['dist-ethers', 'dist-viem']) {
    const dir = path.join(root, name)
    const files = findJsAssets(dir)
    let totalRaw = 0
    let totalGzip = 0
    let totalBrotli = 0
    const filesDetail = []
    for (const f of files) {
      const full = path.join(dir, 'assets', f)
      const size = getSize(full)
      totalRaw += size.raw
      totalGzip += size.gzip
      totalBrotli += size.brotli
      filesDetail.push({ file: f, ...size })
    }
    results[name] = { totalRaw, totalGzip, totalBrotli, files: filesDetail }
  }

  console.log('\n--- Bundle sizes ---')
  console.log(JSON.stringify(results, null, 2))
  console.log('\nSummary:')
  console.log('ethers: raw', results['dist-ethers'].totalRaw, 'gzip', results['dist-ethers'].totalGzip, 'brotli', results['dist-ethers'].totalBrotli)
  console.log('viem:   raw', results['dist-viem'].totalRaw, 'gzip', results['dist-viem'].totalGzip, 'brotli', results['dist-viem'].totalBrotli)

  const outPath = path.join(root, 'bundle-analysis.json')
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2))
  console.log('\nWritten', outPath)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
}).then(() => {})
