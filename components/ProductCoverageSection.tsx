'use client'

import { useMemo, useState } from 'react'
import { Boxes } from 'lucide-react'
import { useProductCoverage } from '@/hooks/useProductCoverage'
import { ProductStageFilter } from '@/components/ProductStageFilter'
import { ProductCoverageOverview } from '@/components/ProductCoverageOverview'
import { ProductCoverageMap } from '@/components/ProductCoverageMap'
import { ProductStageBreakdown, type ProductStageBreakdownRow } from '@/components/ProductStageBreakdown'
import { PRODUCT_STAGES } from '@/types/productCoverage'
import type { ProductCoverageRecord } from '@/types/productCoverage'

function distinctCount(records: ProductCoverageRecord[], key: 'enterpriseId' | 'rooftopId') {
  const set = new Set<string>()
  for (const record of records) {
    const value = record[key]
    if (value) set.add(value)
  }
  return set.size
}

/**
 * "Product / Account Coverage" — an isolated section reading the second
 * (CS/product-status) dataset. Owns its own Product Stage / state / city
 * selection state entirely separately from the existing TAM dashboard's
 * FilterState (hooks/useFilters.ts) and useDashboardData, so nothing here
 * can affect the existing TAM section above it.
 */
export function ProductCoverageSection() {
  const { records, loading, error } = useProductCoverage()
  const [productStage, setProductStage] = useState<string | null>(null)
  const [selectedState, setSelectedState] = useState<string | null>(null)
  const [selectedCity, setSelectedCity] = useState<string | null>(null)

  const usRecords = useMemo(() => (records ?? []).filter((r) => r.isUS), [records])

  const stageFilteredRecords = useMemo(
    () => (productStage ? usRecords.filter((r) => r.productStage === productStage) : usRecords),
    [usRecords, productStage]
  )

  const geoFilteredRecords = useMemo(() => {
    let subset = stageFilteredRecords
    if (selectedState) subset = subset.filter((r) => r.stateCode === selectedState)
    if (selectedCity) subset = subset.filter((r) => r.city.toLowerCase() === selectedCity.toLowerCase())
    return subset
  }, [stageFilteredRecords, selectedState, selectedCity])

  // Breakdown always covers all 10 stages for the current geographic scope,
  // independent of the Product Stage dropdown, so it stays useful as a
  // reference table even when a single stage is selected.
  const geoOnlyRecords = useMemo(() => {
    let subset = usRecords
    if (selectedState) subset = subset.filter((r) => r.stateCode === selectedState)
    if (selectedCity) subset = subset.filter((r) => r.city.toLowerCase() === selectedCity.toLowerCase())
    return subset
  }, [usRecords, selectedState, selectedCity])

  const companies = distinctCount(geoFilteredRecords, 'enterpriseId')
  const rooftops = distinctCount(geoFilteredRecords, 'rooftopId')
  const states = useMemo(() => new Set(geoFilteredRecords.map((r) => r.stateCode).filter(Boolean)).size, [geoFilteredRecords])

  const breakdownRows: ProductStageBreakdownRow[] = useMemo(
    () =>
      PRODUCT_STAGES.map((stage) => {
        const stageRecords = geoOnlyRecords.filter((r) => r.productStage === stage)
        return {
          stage,
          companies: distinctCount(stageRecords, 'enterpriseId'),
          rooftops: distinctCount(stageRecords, 'rooftopId'),
        }
      }),
    [geoOnlyRecords]
  )

  const scopeParts = [
    productStage ?? 'All Product Stages',
    selectedCity ? `${selectedCity}, ${selectedState}` : selectedState ?? 'All States',
  ]
  const scopeLabel = scopeParts.join(' · ')

  return (
    <section>
      <div id="product-coverage" className="scroll-mt-36">
        <div className="mb-4 flex items-start gap-3">
          <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-md bg-slate-950 text-white">
            <Boxes className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Product / Account Coverage</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Actual Studio and Vini account status from the CS live-accounts dataset — separate from the TAM
              market-coverage data above. Filtering here never changes the TAM totals, map, or filters above.
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading product coverage data…
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          Failed to load product coverage data: {error}
        </div>
      )}

      {!loading && !error && records && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="max-w-xs">
              <ProductStageFilter value={productStage} onChange={setProductStage} />
            </div>
          </div>

          <ProductCoverageOverview companies={companies} rooftops={rooftops} states={states} scopeLabel={scopeLabel} />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <ProductCoverageMap
              records={stageFilteredRecords}
              selectedState={selectedState}
              selectedCity={selectedCity}
              onSelectState={setSelectedState}
              onSelectCity={setSelectedCity}
            />
            <ProductStageBreakdown rows={breakdownRows} scopeLabel={`Scope: ${scopeParts[1]}`} />
          </div>
        </div>
      )}
    </section>
  )
}
