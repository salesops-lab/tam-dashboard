'use client'

import { useEffect, useState } from 'react'
import type { ProductCoverageRecord } from '@/types/productCoverage'

// Fetches the second dataset once on mount. The Product / Account Coverage
// section then filters this in-memory array locally (Product Stage /
// state / city selections never trigger a refetch), mirroring how
// useFilters re-slices relevantRecords for the existing TAM dashboard.
export function useProductCoverage() {
  const [records, setRecords] = useState<ProductCoverageRecord[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch('/api/product-coverage')
        if (!response.ok) {
          throw new Error(`Failed to fetch product coverage data: ${response.status}`)
        }
        const json = await response.json()
        if (!cancelled) {
          setRecords(json.records ?? [])
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error')
          setRecords(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return { records, loading, error }
}
