import { build } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

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

function collectBundleReport(outDirName) {
  const dir = path.join(root, outDirName)
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
  return { totalRaw, totalGzip, totalBrotli, files: filesDetail }
}

async function buildFullApp(outDir, inputHtml) {
  await build({
    root,
    plugins: [react()],
    build: {
      outDir,
      rollupOptions: { input: inputHtml },
      emptyOutDir: true,
    },
  })
}

/** Library-only probes: no React; same tree-shaken surface as adapters (see src/lib-bundles). */
async function buildLibProbe(outDir, inputHtml) {
  await build({
    root,
    plugins: [],
    build: {
      outDir,
      rollupOptions: { input: inputHtml },
      emptyOutDir: true,
    },
  })
}

async function main() {
  console.log('Building full-app ethers bundle...')
  await buildFullApp('dist-ethers', path.join(root, 'index-ethers.html'))
  console.log('Building full-app viem bundle...')
  await buildFullApp('dist-viem', path.join(root, 'index-viem.html'))

  console.log('Building library-only ethers probe...')
  await buildLibProbe('dist-lib-ethers', path.join(root, 'index-lib-ethers.html'))
  console.log('Building library-only viem probe...')
  await buildLibProbe('dist-lib-viem', path.join(root, 'index-lib-viem.html'))

  const fullApplication = {
    ethers: collectBundleReport('dist-ethers'),
    viem: collectBundleReport('dist-viem'),
  }

  /** Same import footprint as ethersAdapter / viemAdapter (no app shell). */
  const libraryBundles = {
    ethers: collectBundleReport('dist-lib-ethers'),
    viem: collectBundleReport('dist-lib-viem'),
  }

  /** Nested sections for clarity; flat dist-* keys keep analysis notebooks working. */
  const results = {
    fullApplication,
    libraryBundles,
    'dist-ethers': fullApplication.ethers,
    'dist-viem': fullApplication.viem,
    'dist-lib-ethers': libraryBundles.ethers,
    'dist-lib-viem': libraryBundles.viem,
  }

  console.log('\n--- Full application (React + app + one Web3 stack) ---')
  console.log('ethers:', JSON.stringify(fullApplication.ethers, null, 2))
  console.log('viem:  ', JSON.stringify(fullApplication.viem, null, 2))

  console.log('\n--- Library bundles only (adapter-equivalent imports, no React) ---')
  console.log('ethers:', JSON.stringify(libraryBundles.ethers, null, 2))
  console.log('viem:  ', JSON.stringify(libraryBundles.viem, null, 2))

  console.log('\nSummary full app:')
  console.log('ethers raw', fullApplication.ethers.totalRaw, 'gzip', fullApplication.ethers.totalGzip, 'brotli', fullApplication.ethers.totalBrotli)
  console.log('viem   raw', fullApplication.viem.totalRaw, 'gzip', fullApplication.viem.totalGzip, 'brotli', fullApplication.viem.totalBrotli)

  console.log('\nSummary libraries only:')
  console.log('ethers raw', libraryBundles.ethers.totalRaw, 'gzip', libraryBundles.ethers.totalGzip, 'brotli', libraryBundles.ethers.totalBrotli)
  console.log('viem   raw', libraryBundles.viem.totalRaw, 'gzip', libraryBundles.viem.totalGzip, 'brotli', libraryBundles.viem.totalBrotli)

  const outPath = path.join(root, 'bundle-analysis.json')
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2))
  console.log('\nWritten', outPath)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
