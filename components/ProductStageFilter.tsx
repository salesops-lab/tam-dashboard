'use client'

import { PRODUCT_STAGES } from '@/types/productCoverage'

const ALL_STAGES = 'All Product Stages'

export function ProductStageFilter({
  value,
  onChange,
}: {
  value: string | null
  onChange: (value: string | null) => void
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Product Stage
      </span>
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        className="h-10 w-full min-w-[220px] rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
      >
        <option value="">{ALL_STAGES}</option>
        {PRODUCT_STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {stage}
          </option>
        ))}
      </select>
    </label>
  )
}
