'use client'

export interface ProductStageBreakdownRow {
  stage: string
  companies: number
  rooftops: number
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

export function ProductStageBreakdown({
  rows,
  scopeLabel,
}: {
  rows: ProductStageBreakdownRow[]
  scopeLabel: string
}) {
  const maxRooftops = Math.max(1, ...rows.map((r) => r.rooftops))
  const sorted = [...rows].sort((a, b) => b.rooftops - a.rooftops)

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4">
        <h3 className="text-base font-semibold text-slate-950">Product Stage Breakdown</h3>
        <p className="mt-1 text-xs text-slate-500">{scopeLabel}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="min-w-[180px] text-left">Product Stage</th>
              <th className="text-right">Companies</th>
              <th className="text-right">Rooftops</th>
              <th className="min-w-[120px] text-right"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.stage}>
                <td className="font-medium text-slate-800">{row.stage}</td>
                <td className="text-right text-slate-700">{formatNumber(row.companies)}</td>
                <td className="text-right font-semibold text-slate-950">{formatNumber(row.rooftops)}</td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${(row.rooftops / maxRooftops) * 100}%` }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-sm text-slate-400">
                  No records for this selection.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
