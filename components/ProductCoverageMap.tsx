'use client'

import { useMemo } from 'react'
import { ChevronLeft, MapPin } from 'lucide-react'
import type { ProductCoverageRecord } from '@/types/productCoverage'

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

interface GeoRow {
  key: string
  label: string
  companies: number
  rooftops: number
}

function aggregateBy(records: ProductCoverageRecord[], keyOf: (r: ProductCoverageRecord) => string, labelOf: (r: ProductCoverageRecord) => string): GeoRow[] {
  const buckets = new Map<string, { label: string; companies: Set<string>; rooftops: Set<string> }>()
  for (const record of records) {
    const key = keyOf(record)
    if (!key) continue
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { label: labelOf(record), companies: new Set(), rooftops: new Set() }
      buckets.set(key, bucket)
    }
    if (record.enterpriseId) bucket.companies.add(record.enterpriseId)
    bucket.rooftops.add(record.rooftopId)
  }
  return [...buckets.entries()]
    .map(([key, bucket]) => ({
      key,
      label: bucket.label,
      companies: bucket.companies.size,
      rooftops: bucket.rooftops.size,
    }))
    .sort((a, b) => b.rooftops - a.rooftops)
}

/**
 * Isolated geographic view for the Product / Account Coverage section.
 * The existing dashboard has no literal US map component (its "Geography"
 * section is a state breakdown table) — this mirrors that same clickable,
 * card/table visual language rather than introducing a new map library.
 */
export function ProductCoverageMap({
  records,
  selectedState,
  selectedCity,
  onSelectState,
  onSelectCity,
}: {
  records: ProductCoverageRecord[]
  selectedState: string | null
  selectedCity: string | null
  onSelectState: (code: string | null) => void
  onSelectCity: (city: string | null) => void
}) {
  const usRecords = useMemo(() => records.filter((r) => r.isUS), [records])

  const stateRows = useMemo(
    () => aggregateBy(usRecords, (r) => r.stateCode, (r) => r.stateLabel || r.state),
    [usRecords]
  )

  const stateRecords = useMemo(
    () => (selectedState ? usRecords.filter((r) => r.stateCode === selectedState) : []),
    [usRecords, selectedState]
  )

  const cityRows = useMemo(
    () => aggregateBy(stateRecords, (r) => r.city.toLowerCase(), (r) => r.city),
    [stateRecords]
  )

  const selectedStateLabel = stateRows.find((r) => r.key === selectedState)?.label ?? selectedState

  const rows: GeoRow[] = selectedState ? cityRows : stateRows
  const columnLabel = selectedState ? 'City' : 'State'
  const maxRooftops = Math.max(1, ...rows.map((r) => r.rooftops))

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-slate-500" />
          <h3 className="text-base font-semibold text-slate-950">Geographic View</h3>
        </div>
        {selectedState ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <button
              type="button"
              onClick={() => {
                onSelectState(null)
                onSelectCity(null)
              }}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-medium text-blue-700 hover:bg-blue-50"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              All states
            </button>
            <span>/</span>
            <span className="font-semibold text-slate-700">{selectedStateLabel}</span>
            {selectedCity && (
              <>
                <span>/</span>
                <span className="font-semibold text-slate-700">{selectedCity}</span>
              </>
            )}
          </div>
        ) : (
          <p className="mt-1 text-xs text-slate-500">Click a state to drill into city-level coverage.</p>
        )}
      </div>

      <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="min-w-[160px] text-left">{columnLabel}</th>
              <th className="text-right">Companies</th>
              <th className="text-right">Rooftops</th>
              <th className="min-w-[100px] text-right"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isActiveCity = selectedState && selectedCity?.toLowerCase() === row.key
              return (
                <tr key={row.key} className={isActiveCity ? 'bg-blue-50' : undefined}>
                  <td className="font-medium text-slate-800">
                    <button
                      type="button"
                      onClick={() =>
                        selectedState
                          ? onSelectCity(selectedCity?.toLowerCase() === row.key ? null : row.label)
                          : onSelectState(row.key)
                      }
                      className="rounded-md px-2 py-1 text-left text-blue-700 underline-offset-4 hover:bg-blue-50 hover:underline"
                    >
                      {row.label}
                    </button>
                  </td>
                  <td className="text-right text-slate-700">{formatNumber(row.companies)}</td>
                  <td className="text-right font-semibold text-slate-950">{formatNumber(row.rooftops)}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: `${(row.rooftops / maxRooftops) * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-sm text-slate-400">
                  No US records for this selection.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
