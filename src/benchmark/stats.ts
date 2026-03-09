/**
 * Statistics for benchmark timings (ms).
 */
export interface TimingStats {
  mean: number
  min: number
  max: number
  p50: number
  p95: number
  p99: number
  count: number
}

export function computeStats(timings: number[]): TimingStats {
  if (timings.length === 0) {
    return { mean: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0, count: 0 }
  }
  const sorted = [...timings].sort((a, b) => a - b)
  const sum = sorted.reduce((s, t) => s + t, 0)
  const mean = sum / sorted.length
  const min = sorted[0]!
  const max = sorted[sorted.length - 1]!
  const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? max
  const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? max
  return { mean, min, max, p50, p95, p99, count: sorted.length }
}
