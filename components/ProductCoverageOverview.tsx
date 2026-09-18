'use client'

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function MetricTile({ title, value, helper }: { title: string; value: number; helper?: string }) {
  return (
    <article className="flex flex-col rounded-xl border border-t-4 border-slate-200 border-t-blue-600 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <p className="mt-3 text-4xl font-light tracking-normal text-slate-950">{formatNumber(value)}</p>
      {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
    </article>
  )
}

export function ProductCoverageOverview({
  companies,
  rooftops,
  states,
  scopeLabel,
}: {
  companies: number
  rooftops: number
  states: number
  scopeLabel: string
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <MetricTile title="Companies" value={companies} helper={`Distinct enterprise IDs · ${scopeLabel}`} />
      <MetricTile title="Rooftops" value={rooftops} helper={`Distinct rooftop IDs · ${scopeLabel}`} />
      <MetricTile title="States" value={states} helper={`US states represented · ${scopeLabel}`} />
    </div>
  )
}
