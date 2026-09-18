'use client'

import React, { Suspense, useMemo, useState, type ReactNode } from 'react'
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Boxes,
  Building2,
  Database,
  Download,
  ExternalLink,
  Grid2X2,
  Layers3,
  Map,
  ShieldAlert,
  Upload,
  Users2,
} from 'lucide-react'
import { BreakdownTable } from '@/components/BreakdownTableNew'
import { CrossTabTable } from '@/components/CrossTabTable'
import { DealerGroupTable } from '@/components/DealerGroupTable'
import { PodView, type PodStat, type Market } from '@/components/PodView'
import { PODS, OWNER_TO_POD } from '@/lib/pods'
import { DrilldownModal } from '@/components/DrilldownModal'
import { FilterBar } from '@/components/FilterBarNew'
import { SyncStatusBanner } from '@/components/SyncStatusBanner'
import { useDashboardData } from '@/hooks/useDashboardData'
import { useFilters } from '@/hooks/useFilters'
import { useSyncStatus } from '@/hooks/useSyncStatus'
import { downloadCsv, csvFilename } from '@/lib/exportCsv'
import type { DrilldownMeasure, GroupRow, MinifiedRecord } from '@/types/dashboard'

type CountMetric = { rooftops: number; companies: number }
// Placeholder metric for group cards that display an account count + Franchise/Independent
// split (so the rooftops/companies fallback line is never shown).
const ZERO_METRIC: CountMetric = { rooftops: 0, companies: 0 }

// Map a baked segment code to its market bucket (shared by the Pod stats + drilldown).
function marketOf(sg: string | null): Market | undefined {
  return sg === 'SMB' ? 'smb'
    : sg === 'MM_SINGLE' || sg === 'MM_GROUP' ? 'mm'
      : sg === 'ENT_A' || sg === 'ENT_B' || sg === 'ENT_C' || sg === 'TOP_150' ? 'ent'
        : sg === 'UNSIZED' ? 'unsized' : undefined
}
const MARKET_LABEL: Record<Market, string> = { smb: 'SMB', mm: 'Mid Market', ent: 'Enterprise', unsized: 'Unsized' }
type DrilldownField = keyof Pick<MinifiedRecord, 'ot' | 'td' | 'cn' | 'cp' | 'st' | 'tm' | 'pn' | 'ls'>
type BreakdownDrilldownConfig = {
  field: DrilldownField
  segmentColumn: string
  predicate?: (record: MinifiedRecord) => boolean
}
type DrilldownModalState = {
  reportTitle: string
  segmentLabel: string
  segmentColumn: string
  measure: DrilldownMeasure
  records: MinifiedRecord[]
}

const sections = [
  { id: 'overview', label: 'Dashboard', icon: Grid2X2 },
  { id: 'segmentation', label: 'AOP Segments', icon: Boxes },
  { id: 'pods', label: 'Pod View', icon: Users2 },
  { id: 'market', label: 'Market Segments', icon: Layers3 },
  { id: 'geography', label: 'Geography', icon: Map },
  { id: 'systems', label: 'Systems & Vendors', icon: Database },
  { id: 'ownership', label: 'GTM Ownership', icon: Users2 },
  { id: 'quality', label: 'Data Quality', icon: ShieldAlert },
]

const hubspotReportLinks = {
  dashboard: 'https://app-na2.hubspot.com/reports-dashboard/242626590/view/137527807',
  relevantTam: 'https://app-na2.hubspot.com/reports-dashboard/242626590/view/137527807/264400707',
  withoutDomains: 'https://app-na2.hubspot.com/reports-dashboard/242626590/view/137527807/264448565',
  carsforsale: 'https://app-na2.hubspot.com/reports-dashboard/242626590/view/137527807/264400849',
  contractClosed: 'https://app-na2.hubspot.com/reports-dashboard/242626590/view/137527807/264401118',
  franchiseTam: 'https://app-na2.hubspot.com/reports-dashboard/242626590/view/137527807/264400788',
  independentTam: 'https://app-na2.hubspot.com/reports-dashboard/242626590/view/137527807/264448625',
  sizeWise: 'https://app-na2.hubspot.com/reports-list/242626590/264332575/?search=SIZE%20WI',
  dealershipTypeWise: 'https://app-na2.hubspot.com/reports-list/242626590/264332884/?search=Dealership%20Type%20Wise%20Relevant%20TAM',
  competitorWise: 'https://app-na2.hubspot.com/reports-list/242626590/264345917/?search=Competitor%20Wise%20Relevant%20TAM',
  stateWise: 'https://app-na2.hubspot.com/reports-list/242626590/264345550/?search=State%20Wise%20Relevant%20TAM',
  crmWise: 'https://app-na2.hubspot.com/reports-list/242626590/264345535/?search=CRM%20Wise%20Relevant%20TAM',
  teamWise: 'https://app-na2.hubspot.com/reports-list/242626590/264347368/?search=Team%20Wise%20Relevant%20TAM',
  stateTeamWise: 'https://app-na2.hubspot.com/reports-list/242626590/264401667/?search=State-Team%20wise%20Relevant%20TAM',
  partnershipWise: 'https://app-na2.hubspot.com/reports-dashboard/242626590/view/137527807/264401475',
  franchiseCrmWise: 'https://app-na2.hubspot.com/reports-list/242626590/264448687/?search=Franchise%20CRM%20wise%20TAM',
  independentCrmWise: 'https://app-na2.hubspot.com/reports-dashboard/242626590/view/137527807/264448830',
  franchiseStageWise: 'https://app-na2.hubspot.com/reports-dashboard/242626590/view/137527807/264448989',
  independentStageWise: 'https://app-na2.hubspot.com/reports-dashboard/242626590/view/137527807/264449049',
  lifecycleStageWise: 'https://app-na2.hubspot.com/reports-list/242626590/264401023/',
} as const

const NO_VALUE = '(No value)'
const drilldownConfigs = {
  orgTier: { field: 'ot', segmentColumn: 'Org Tier' },
  dealershipType: { field: 'td', segmentColumn: 'Dealership Type' },
  crm: { field: 'cp', segmentColumn: 'CRM Platform' },
  competitor: { field: 'cn', segmentColumn: 'Competitor' },
  state: { field: 'st', segmentColumn: 'State' },
  team: { field: 'tm', segmentColumn: 'HubSpot Team' },
  lifecycle: { field: 'ls', segmentColumn: 'Lifecycle Stage' },
  partnership: { field: 'pn', segmentColumn: 'Partnership' },
  franchiseCrm: {
    field: 'cp',
    segmentColumn: 'CRM Platform',
    predicate: (record: MinifiedRecord) => record.td === 'Franchise',
  },
  independentCrm: {
    field: 'cp',
    segmentColumn: 'CRM Platform',
    predicate: (record: MinifiedRecord) => record.td === 'Independent',
  },
  franchiseStage: {
    field: 'ls',
    segmentColumn: 'Lifecycle Stage',
    predicate: (record: MinifiedRecord) => record.td === 'Franchise',
  },
  independentStage: {
    field: 'ls',
    segmentColumn: 'Lifecycle Stage',
    predicate: (record: MinifiedRecord) => record.td === 'Independent',
  },
} satisfies Record<string, BreakdownDrilldownConfig>

function formatNumber(value: number) {
  return value.toLocaleString()
}

function formatPercent(numerator: number, denominator: number) {
  if (!denominator) return '0.0%'
  return `${((numerator / denominator) * 100).toFixed(1)}%`
}

function averageRooftops(metric: CountMetric) {
  if (!metric.companies) return '0.0'
  return (metric.rooftops / metric.companies).toFixed(1)
}

function isPlaceholderRow(row: GroupRow) {
  return row.key === NO_VALUE || row.label === NO_VALUE || row.label === '(No Team)'
}

function orderedRows(rows: GroupRow[]) {
  return [...rows].sort((a, b) => {
    const aPlaceholder = isPlaceholderRow(a)
    const bPlaceholder = isPlaceholderRow(b)
    if (aPlaceholder !== bPlaceholder) return aPlaceholder ? 1 : -1
    return b.rooftops - a.rooftops
  })
}

function topRows(rows: GroupRow[], count = 5, options?: { excludePlaceholders?: boolean }) {
  const rankedRows = orderedRows(rows)
  return (options?.excludePlaceholders
    ? rankedRows.filter((row) => !isPlaceholderRow(row))
    : rankedRows
  ).slice(0, count)
}

function hasKnownDomain(record: MinifiedRecord) {
  return Boolean(record.dm)
}

function segmentValue(record: MinifiedRecord, field: DrilldownField) {
  return record[field] ?? NO_VALUE
}

function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col bg-[#101a2e] text-slate-300 shadow-2xl lg:flex">
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white shadow-lg shadow-blue-950/30">
          S
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold tracking-wide text-white">SPYNE</p>
            <span className="rounded-md border border-blue-400/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-200">
              AI
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">TAM Distribution</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 px-4 py-6">
        <div>
          <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Main
          </p>
          <div className="mt-3 space-y-1">
            {sections.map((section, index) => {
              const Icon = section.icon
              return (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                    index === 0
                      ? 'border border-blue-500/30 bg-blue-500/15 font-semibold text-white'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {section.label}
                </a>
              )
            })}
          </div>
        </div>

        <div>
          <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Actions
          </p>
          <div className="mt-3 space-y-1">
            <a className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white">
              <Upload className="h-4 w-4" />
              Sync History
            </a>
            <a className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white">
              <Activity className="h-4 w-4" />
              Data Health
            </a>
          </div>
        </div>
      </nav>
    </aside>
  )
}

function TopBar({
  lastSynced,
  metricCount,
}: {
  lastSynced: string
  metricCount: number
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-20 items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-3">
          <div className="hidden rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm md:block">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />
            HubSpot TAM data
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm md:block">
            <span className="font-semibold text-blue-700">{metricCount.toLocaleString()}</span> records loaded
          </div>
          <div className="hidden rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm xl:block">
            Last synced <span className="font-medium text-slate-900">{lastSynced}</span>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-600 font-semibold text-white shadow-lg shadow-blue-900/20">
            K
          </div>
        </div>
      </div>
    </header>
  )
}

function countDistinctCompanies(records: MinifiedRecord[]) {
  return new Set(records.map((record) => record.gi).filter(Boolean)).size
}

function summarizeRecords(records: MinifiedRecord[]): CountMetric {
  return {
    rooftops: records.length,
    companies: countDistinctCompanies(records),
  }
}

function buildMissingFieldRows(records: MinifiedRecord[]): GroupRow[] {
  const missingFields = [
    { label: 'Domain', key: 'dm' },
    { label: 'HubSpot Team', key: 'tm' },
    { label: 'CRM Platform', key: 'cp' },
    { label: 'DMS Name', key: 'dn' },
    { label: 'State', key: 'st' },
    { label: 'Lifecycle Stage', key: 'ls' },
    { label: 'Partner Name', key: 'pn' },
    { label: 'Dealer Group ID', key: 'gi' },
  ] as const

  return missingFields
    .map(({ label, key }) => {
      const missing = records.filter((record) => !record[key])
      return {
        key,
        label,
        ...summarizeRecords(missing),
      }
    })
    .sort((a, b) => b.rooftops - a.rooftops)
}

function findRow(rows: GroupRow[], label: string) {
  return rows.find((row) => row.label.toLowerCase() === label.toLowerCase())
}

function MetricCard({
  title,
  metric,
  helper,
  denominator,
  tone = 'default',
  reportHref,
  accounts,
  accountsUnit = 'groups',
  subtitle,
  split,
  groupSplit,
  rows,
  footer,
}: {
  title: string
  metric: CountMetric
  helper?: string
  denominator?: number
  tone?: 'default' | 'risk' | 'success'
  reportHref?: string
  accounts?: number
  accountsUnit?: string
  subtitle?: string
  split?: { rooftops?: number; franchise: number; independent: number }
  groupSplit?: { franchise: number; independent: number }
  rows?: Array<{ label: string; franchise: number; independent: number; indent?: boolean; muted?: boolean }>
  footer?: React.ReactNode
}) {
  // Group-based segments lead with the account/group count (region-independent),
  // with rooftops shown as the supporting measure.
  const isAccountsView = accounts !== undefined
  const handleExport = () => {
    if (isAccountsView) {
      downloadCsv(csvFilename(title), ['Metric', 'Groups', 'Rooftops', 'Companies'], [[title, accounts!, metric.rooftops, metric.companies]])
    } else {
      const headers = ['Metric', 'Rooftops', 'Companies']
      const row: Array<string | number> = [title, metric.rooftops, metric.companies]
      if (denominator !== undefined) { headers.push('Share %'); row.push(((metric.rooftops / (denominator || 1)) * 100).toFixed(1)) }
      downloadCsv(csvFilename(title), headers, [row])
    }
  }
  const toneClasses = {
    default: 'border-t-blue-600',
    risk: 'border-t-amber-500',
    success: 'border-t-emerald-500',
  }
  const pillClasses = {
    default: 'bg-blue-50 text-blue-700 ring-blue-100',
    risk: 'bg-amber-50 text-amber-700 ring-amber-100',
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  }

  return (
    <article className={`flex flex-col rounded-xl border border-t-4 border-slate-200 bg-white p-6 shadow-sm ${toneClasses[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
            {reportHref && (
              <a
                href={reportHref}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${title} in HubSpot`}
                title={`Open ${title} in HubSpot`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <button
              type="button"
              onClick={handleExport}
              aria-label={`Download ${title} as CSV`}
              title="Download as Excel (CSV)"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-3 text-4xl font-light tracking-normal text-slate-950">
            {formatNumber(isAccountsView ? accounts! : metric.rooftops)}
            {isAccountsView && <span className="ml-2 text-base font-medium text-slate-400">{accountsUnit}</span>}
          </p>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {denominator !== undefined && !isAccountsView && (
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${pillClasses[tone]}`}>
            {formatPercent(metric.rooftops, denominator)}
          </span>
        )}
      </div>
      {/* Inline split table — custom rows take precedence, else group/rooftop split */}
      {(rows || split || groupSplit) ? (
        <div className="mt-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-slate-400">
                <th className="pb-1 text-left font-medium w-[44%]"></th>
                <th className="pb-1 text-right font-medium">Fr / GFD</th>
                <th className="pb-1 text-right font-medium">Ind / IGD</th>
                <th className="pb-1 text-right font-medium text-slate-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows ? (
                rows.map((r) => (
                  <tr key={r.label} className="border-t border-slate-100">
                    <td className={`py-0.5 ${r.indent ? 'pl-3 text-slate-400' : 'font-medium text-slate-600'}`}>{r.label}</td>
                    <td className={`py-0.5 text-right tabular-nums ${r.muted ? 'text-slate-400' : 'text-slate-700'}`}>{formatNumber(r.franchise)}</td>
                    <td className={`py-0.5 text-right tabular-nums ${r.muted ? 'text-slate-400' : 'text-slate-700'}`}>{formatNumber(r.independent)}</td>
                    <td className="py-0.5 text-right font-semibold tabular-nums text-slate-900">{formatNumber(r.franchise + r.independent)}</td>
                  </tr>
                ))
              ) : (
                <>
                  {groupSplit && (
                    <tr className="border-t border-slate-100">
                      <td className="py-0.5 font-medium text-slate-600">Groups</td>
                      <td className="py-0.5 text-right tabular-nums text-slate-700">{formatNumber(groupSplit.franchise)}</td>
                      <td className="py-0.5 text-right tabular-nums text-slate-700">{formatNumber(groupSplit.independent)}</td>
                      <td className="py-0.5 text-right font-semibold tabular-nums text-slate-900">{formatNumber(groupSplit.franchise + groupSplit.independent)}</td>
                    </tr>
                  )}
                  {split && (
                    <tr className="border-t border-slate-100">
                      <td className="py-0.5 font-medium text-slate-600">
                        {formatNumber(split.rooftops ?? metric.rooftops)} rooftops
                      </td>
                      <td className="py-0.5 text-right tabular-nums text-slate-700">{formatNumber(split.franchise)}</td>
                      <td className="py-0.5 text-right tabular-nums text-slate-700">{formatNumber(split.independent)}</td>
                      <td className="py-0.5 text-right font-semibold tabular-nums text-slate-900">{formatNumber(split.franchise + split.independent)}</td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span>{formatNumber(metric.companies)} companies</span>
          <span>{averageRooftops(metric)} rt/co.</span>
        </div>
      )}
      {helper && <p className="mt-3 text-xs leading-5 text-slate-500">{helper}</p>}
      {/* Footer pinned to bottom so all cards in a row align their buttons */}
      {footer && <div className="mt-auto border-t border-slate-100 pt-3">{footer}</div>}
    </article>
  )
}

type MatrixRow = {
  label: string
  groups: number
  rooftops: number
  franchise: number
  independent: number
  showGroups: boolean
  kind: 'segment' | 'subtotal' | 'total'
  indent?: boolean
}

function SegmentMatrixTable({ rows }: { rows: MatrixRow[] }) {
  const handleExport = () => {
    downloadCsv(
      'tam-segmentation-matrix',
      ['Segment', 'Groups', 'Rooftops', 'Franchise', 'Independent'],
      rows.map((r) => [r.label.trim(), r.showGroups ? r.groups : '', r.rooftops, r.franchise, r.independent])
    )
  }
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
        <div>
          <h3 className="text-base font-semibold text-slate-950">TAM Segmentation — Rooftop Breakdown</h3>
          <p className="mt-1 text-xs text-slate-500">
            Franchise/Independent split is based on rooftop Dealership Type. Group counts are canonical.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          aria-label="Download segmentation matrix as CSV"
          title="Download as Excel (CSV)"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2 text-left">Segment</th>
              <th className="px-4 py-2 text-right">Groups</th>
              <th className="px-4 py-2 text-right">Total Rooftops</th>
              <th className="px-4 py-2 text-right">Franchise</th>
              <th className="px-4 py-2 text-right">Independent</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const rowClass =
                r.kind === 'total'
                  ? 'border-t-2 border-slate-200 bg-slate-100 font-semibold text-slate-900'
                  : r.kind === 'subtotal'
                    ? 'border-t border-slate-200 bg-slate-50 font-semibold text-slate-900'
                    : 'border-t border-slate-100'
              return (
                <tr key={`${r.label}-${idx}`} className={rowClass}>
                  <td className={`px-4 py-2 ${r.indent ? 'pl-8 text-slate-600' : 'font-medium text-slate-800'}`}>{r.label}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-500">
                    {r.showGroups && r.groups > 0 ? formatNumber(r.groups) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-950">{formatNumber(r.rooftops)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatNumber(r.franchise)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatNumber(r.independent)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

type StageMap = Record<string, { franchise: number; independent: number }>

// Shared toggle button for card footers
function ToggleBtn({ label, open, onClick }: { label: string; open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
        open
          ? 'border-blue-300 bg-blue-50 text-blue-700'
          : 'border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'
      }`}
    >
      {label}
      <span className={`text-[10px] transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
    </button>
  )
}

// Pod breakdown panel
function PodBucketBreakdown({
  podCounts,
  totalRooftops,
  onRowClick,
}: {
  podCounts: Array<{ franchise: number; independent: number }>
  totalRooftops: number
  onRowClick?: (podIdx: number, type: 'Franchise' | 'Independent' | null) => void
}) {
  const attributed = podCounts.reduce((s, p) => s + p.franchise + p.independent, 0)
  const unattributed = totalRooftops - attributed
  const cell = (value: number, podIdx: number, type: 'Franchise' | 'Independent' | null) =>
    onRowClick && value > 0 ? (
      <button type="button" onClick={() => onRowClick(podIdx, type)}
        className="rounded px-0.5 tabular-nums text-blue-700 underline-offset-2 hover:bg-blue-50 hover:underline" title="View companies">
        {formatNumber(value)}
      </button>
    ) : <span className="tabular-nums">{formatNumber(value)}</span>

  return (
    <table className="mt-2 w-full text-xs">
      <thead>
        <tr className="text-[10px] uppercase tracking-wide text-slate-400">
          <th className="pb-1 text-left font-medium">Pod</th>
          <th className="pb-1 text-right font-medium">Fr</th>
          <th className="pb-1 text-right font-medium">Ind</th>
          <th className="pb-1 text-right font-medium">Total</th>
        </tr>
      </thead>
      <tbody>
        {PODS.map((pod, i) => {
          const { franchise: fr, independent: ind } = podCounts[i]
          const total = fr + ind
          if (total === 0) return null
          return (
            <tr key={pod.lead} className="border-t border-slate-100">
              <td className="py-0.5 text-slate-600">{pod.lead}</td>
              <td className="py-0.5 text-right">{cell(fr, i, 'Franchise')}</td>
              <td className="py-0.5 text-right">{cell(ind, i, 'Independent')}</td>
              <td className="py-0.5 text-right font-semibold text-slate-800">{cell(total, i, null)}</td>
            </tr>
          )
        })}
        {unattributed > 0 && (
          <tr className="border-t border-slate-100">
            <td className="py-0.5 italic text-slate-400">Unattributed</td>
            <td colSpan={2} className="py-0.5 text-right tabular-nums text-slate-400">—</td>
            <td className="py-0.5 text-right tabular-nums text-slate-400">{formatNumber(unattributed)}</td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

// Stages (GD Level) breakdown panel
function StageBucketBreakdown({ stageMap }: { stageMap: StageMap }) {
  const rows = Object.entries(stageMap)
    .map(([k, v]) => ({ label: k === '(No value)' ? 'No stage' : k, franchise: v.franchise, independent: v.independent }))
    .sort((a, b) => (b.franchise + b.independent) - (a.franchise + a.independent))
  return (
    <table className="mt-2 w-full text-xs">
      <thead>
        <tr className="text-[10px] uppercase tracking-wide text-slate-400">
          <th className="pb-1 text-left font-medium">Stage (GD Level)</th>
          <th className="pb-1 text-right font-medium">Fr</th>
          <th className="pb-1 text-right font-medium">Ind</th>
          <th className="pb-1 text-right font-medium">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-t border-slate-100">
            <td className="py-0.5 text-slate-600">{r.label}</td>
            <td className="py-0.5 text-right tabular-nums text-slate-700">{formatNumber(r.franchise)}</td>
            <td className="py-0.5 text-right tabular-nums text-slate-700">{formatNumber(r.independent)}</td>
            <td className="py-0.5 text-right font-semibold tabular-nums text-slate-800">{formatNumber(r.franchise + r.independent)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Combined footer: aligned Pod | Stages [| By rooftop] toggles on one row
function CardFooter({
  podCounts,
  totalRooftops,
  stageMap,
  onPodRowClick,
  rooftopPanel,
}: {
  podCounts: Array<{ franchise: number; independent: number }>
  totalRooftops: number
  stageMap: StageMap
  onPodRowClick?: (podIdx: number, type: 'Franchise' | 'Independent' | null) => void
  rooftopPanel?: React.ReactNode
}) {
  const [panel, setPanel] = useState<'pod' | 'stages' | 'rooftop' | null>(null)
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <ToggleBtn label="Pod breakdown" open={panel === 'pod'} onClick={() => setPanel((p) => p === 'pod' ? null : 'pod')} />
        <ToggleBtn label="Stages" open={panel === 'stages'} onClick={() => setPanel((p) => p === 'stages' ? null : 'stages')} />
        {rooftopPanel && <ToggleBtn label="By rooftop" open={panel === 'rooftop'} onClick={() => setPanel((p) => p === 'rooftop' ? null : 'rooftop')} />}
      </div>
      {panel === 'pod' && <PodBucketBreakdown podCounts={podCounts} totalRooftops={totalRooftops} onRowClick={onPodRowClick} />}
      {panel === 'stages' && <StageBucketBreakdown stageMap={stageMap} />}
      {panel === 'rooftop' && <div className="mt-2">{rooftopPanel}</div>}
    </div>
  )
}

// ── MM Rooftop-count table (individual counts 1-10) ──────────────────────────
type DealerGroupFull = { name: string; segment: string; type: string; rooftops: number; rank: string; members: number }

function MMRooftopCountTable({
  groups,
  mmRooftopPodSplit,
  range = [2, 6],
  compact = false,
}: {
  groups: DealerGroupFull[]
  mmRooftopPodSplit?: Record<string, Array<{ franchise: number; independent: number }>>
  range?: [number, number]
  compact?: boolean
}) {
  // Groups start at 2 rooftops — a 1-rooftop "group" is a single dealer, not a group.
  const [openRow, setOpenRow] = useState<number | null>(null)
  const mmGroups = groups.filter((g) => g.segment === 'MM_GROUP')
  const buckets: Array<{ n: number; gfd: number; igd: number; groupNames: DealerGroupFull[] }> = []
  for (let n = range[0]; n <= range[1]; n++) {
    const matches = mmGroups.filter((g) => g.rooftops === n)
    buckets.push({ n, gfd: matches.filter((g) => g.type === 'GFD').length, igd: matches.filter((g) => g.type === 'IGD').length, groupNames: matches })
  }
  const totGfd = buckets.reduce((s, b) => s + b.gfd, 0)
  const totIgd = buckets.reduce((s, b) => s + b.igd, 0)
  const pad = compact ? 'px-2 py-1.5' : 'px-4 py-2'

  const tableEl = (
    <div className="overflow-x-auto">
      <table className={`w-full ${compact ? 'text-xs' : 'text-sm'}`}>
        <thead>
          <tr className={`${compact ? 'text-[10px]' : 'text-xs'} uppercase tracking-wide text-slate-500`}>
            <th className={`${pad} text-left`}>Rooftops</th>
            <th className={`${pad} text-right`}>GFD (Fr)</th>
            <th className={`${pad} text-right`}>IGD (Ind)</th>
            <th className={`${pad} text-right`}>Total</th>
            <th className={`${pad} text-right`}>Share</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => {
            const total = b.gfd + b.igd
            const share = totGfd + totIgd > 0 ? (total / (totGfd + totIgd)) * 100 : 0
            const isOpen = openRow === b.n
            const label = `${b.n} rooftop${b.n === 1 ? '' : 's'}`
            return (
              <React.Fragment key={b.n}>
                <tr className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => setOpenRow(isOpen ? null : b.n)}>
                  <td className={`${pad} font-medium text-blue-700 hover:underline`}>{label} {isOpen ? '▴' : '▾'}</td>
                  <td className={`${pad} text-right tabular-nums text-slate-700`}>{formatNumber(b.gfd)}</td>
                  <td className={`${pad} text-right tabular-nums text-slate-700`}>{formatNumber(b.igd)}</td>
                  <td className={`${pad} text-right font-semibold tabular-nums text-slate-950`}>{formatNumber(total)}</td>
                  <td className={`${pad} text-right tabular-nums text-slate-500`}>{share.toFixed(1)}%</td>
                </tr>
                {isOpen && (() => {
                  const exactPodCounts = mmRooftopPodSplit?.[String(b.n)] ?? []
                  const hasExactData = exactPodCounts.reduce((s, p) => s + p.franchise + p.independent, 0) > 0
                  return (
                    <tr className="border-t border-blue-100 bg-blue-50/40">
                      <td colSpan={5} className={compact ? 'px-2 py-2' : 'px-4 py-3'}>
                        <div className={`grid gap-6 ${compact ? '' : 'sm:grid-cols-2'}`}>
                          <div>
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Pod ownership — {label} <span className="font-normal normal-case text-slate-400">(groups, Fr=GFD/Ind=IGD)</span>
                              {!hasExactData && <span className="ml-1 font-normal normal-case text-amber-600">refresh data</span>}
                            </p>
                            {hasExactData ? (
                              <>
                                <PodBucketBreakdown podCounts={exactPodCounts} totalRooftops={b.gfd + b.igd} />
                                <p className="mt-1 text-[10px] italic text-slate-400">Each group counted once, assigned to the pod owning the most of its rooftops.</p>
                              </>
                            ) : (
                              <p className="text-xs italic text-slate-400">No pod data yet — trigger a sync.</p>
                            )}
                          </div>
                          <div>
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Groups with exactly {label} ({b.groupNames.length})</p>
                            <div className="max-h-52 space-y-0.5 overflow-y-auto text-xs">
                              {b.groupNames.map((g) => (
                                <div key={g.name} className="flex items-center justify-between gap-2">
                                  <span className="truncate text-slate-700">{g.name}</span>
                                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${g.type === 'GFD' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{g.type}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })()}
              </React.Fragment>
            )
          })}
          <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
            <td className={pad}>Total</td>
            <td className={`${pad} text-right tabular-nums`}>{formatNumber(totGfd)}</td>
            <td className={`${pad} text-right tabular-nums`}>{formatNumber(totIgd)}</td>
            <td className={`${pad} text-right tabular-nums`}>{formatNumber(totGfd + totIgd)}</td>
            <td className={`${pad} text-right`}>100%</td>
          </tr>
        </tbody>
      </table>
    </div>
  )

  if (compact) return tableEl

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
        <div>
          <h3 className="text-base font-semibold text-slate-950">Mid Market — Groups by Rooftop Count</h3>
          <p className="mt-1 text-xs text-slate-500">
            GFD (Franchise) vs IGD (Independent) at each rooftop count. Click a row to see pod breakdown + group names.
          </p>
        </div>
        <button type="button" onClick={() => downloadCsv('mm-rooftop-count', ['Rooftops', 'GFD', 'IGD', 'Total'],
            [...buckets.map(b => [b.n, b.gfd, b.igd, b.gfd + b.igd]), ['Total', totGfd, totIgd, totGfd + totIgd]])}
          aria-label="Download MM rooftop table as CSV" title="Download as Excel (CSV)"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
          <Download className="h-4 w-4" />
        </button>
      </div>
      {tableEl}
    </section>
  )
}

// ── SMB deep dive ─────────────────────────────────────────────────────────────
type CellLike = { rooftops: number; franchise: number; independent: number }
function SMBDeepDive({
  cell, smbGt50, smbPodGt50, smbPodLe50, smbStageGt50, smbStageLe50, onPodRowClick,
}: {
  cell: CellLike
  smbGt50?: { franchise: number; independent: number; rooftops: number }
  smbPodGt50?: Array<{ franchise: number; independent: number }>
  smbPodLe50?: Array<{ franchise: number; independent: number }>
  smbStageGt50?: Record<string, { franchise: number; independent: number }>
  smbStageLe50?: Record<string, { franchise: number; independent: number }>
  onPodRowClick?: (podIdx: number, type: 'Franchise' | 'Independent' | null) => void
}) {
  const [podPanel, setPodPanel] = useState<'gt50' | 'le50' | null>(null)
  const hasGt50 = !!smbGt50
  const hasPodGt50 = smbPodGt50 && smbPodGt50.some(p => p.franchise + p.independent > 0)
  const hasPodLe50 = smbPodLe50 && smbPodLe50.some(p => p.franchise + p.independent > 0)

  // Derive ≤50 bucket from totals minus >50.
  const frGt50 = smbGt50?.franchise ?? 0
  const indGt50 = smbGt50?.independent ?? 0
  const frLe50 = cell.franchise - frGt50
  const indLe50 = cell.independent - indGt50

  const exportRows = hasGt50
    ? [
        ['Franchise — >50 used cars', frGt50, ''],
        ['Franchise — ≤50 used cars', frLe50, ''],
        ['Franchise — Total', cell.franchise, ''],
        ['Independent — >50 used cars', '', indGt50],
        ['Independent — ≤50 used cars', '', indLe50],
        ['Independent — Total', '', cell.independent],
        ['Grand Total', cell.franchise, cell.independent],
      ]
    : [['All SMB (Franchise)', cell.franchise, ''], ['All SMB (Independent)', '', cell.independent]]

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
        <div>
          <h3 className="text-base font-semibold text-slate-950">SMB — Deep Dive</h3>
          <p className="mt-1 text-xs text-slate-500">
            SMB is <strong>single-location independent dealers</strong> (no multi-rooftop group) with ≤100 used cars —
            each = one rooftop. <strong>All franchise singles are Mid Market</strong> (not SMB), so this segment and the
            used-car split below are effectively Independent-only.
            {!hasGt50 && <span className="ml-1 italic text-amber-600">Refresh data to populate the &gt;50 / ≤50 used-car split.</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => downloadCsv('smb-deepdive', ['Segment', 'Franchise', 'Independent'],
            exportRows as Array<Array<string | number>>)}
          aria-label="Download SMB deep dive as CSV"
          title="Download as Excel (CSV)"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2 text-left">Used-car band</th>
              <th className="px-4 py-2 text-right">Franchise</th>
              <th className="px-4 py-2 text-right">Independent</th>
              <th className="px-4 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {hasGt50 ? (
              <>
                {/* >50 row — pod breakdown shows overall SMB ownership (per-pod uc split needs re-sync) */}
                <tr className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                    onClick={() => setPodPanel((p) => p === 'gt50' ? null : 'gt50')}>
                  <td className="px-4 py-2 font-medium text-blue-700 hover:underline">
                    &gt;50 used cars {podPanel === 'gt50' ? '▴' : '▾'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700">{formatNumber(frGt50)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700">{formatNumber(indGt50)}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-950">{formatNumber(frGt50 + indGt50)}</td>
                </tr>
                {podPanel === 'gt50' && (
                  <tr className="border-t border-blue-100 bg-blue-50/40">
                    <td colSpan={4} className="px-4 py-3 text-xs">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Pod breakdown — SMB &gt;50 used cars
                        {!hasPodGt50 && <span className="ml-1 font-normal normal-case text-amber-600">refresh data to populate</span>}
                      </p>
                      {hasPodGt50 ? (
                        <PodBucketBreakdown podCounts={smbPodGt50!} totalRooftops={frGt50 + indGt50} onRowClick={onPodRowClick} />
                      ) : (
                        <p className="text-xs italic text-slate-400">Trigger a sync to compute per-pod &gt;50 used-car breakdown.</p>
                      )}
                      {smbStageGt50 && Object.keys(smbStageGt50).length > 0 && (
                        <div className="mt-3">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Lifecycle stage (GD Level) — &gt;50 used cars</p>
                          <StageBucketBreakdown stageMap={smbStageGt50} />
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                {/* ≤50 row — same pod ownership data as >50 (no per-pod uc split) */}
                <tr className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                    onClick={() => setPodPanel((p) => p === 'le50' ? null : 'le50')}>
                  <td className="px-4 py-2 font-medium text-blue-700 hover:underline">
                    ≤50 used cars {podPanel === 'le50' ? '▴' : '▾'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700">{formatNumber(frLe50)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700">{formatNumber(indLe50)}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-950">{formatNumber(frLe50 + indLe50)}</td>
                </tr>
                {podPanel === 'le50' && (
                  <tr className="border-t border-blue-100 bg-blue-50/40">
                    <td colSpan={4} className="px-4 py-3 text-xs">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Pod breakdown — SMB ≤50 used cars
                        {!hasPodLe50 && <span className="ml-1 font-normal normal-case text-amber-600">refresh data to populate</span>}
                      </p>
                      {hasPodLe50 ? (
                        <PodBucketBreakdown podCounts={smbPodLe50!} totalRooftops={frLe50 + indLe50} onRowClick={onPodRowClick} />
                      ) : (
                        <p className="text-xs italic text-slate-400">Trigger a sync to compute per-pod ≤50 used-car breakdown.</p>
                      )}
                      {smbStageLe50 && Object.keys(smbStageLe50).length > 0 && (
                        <div className="mt-3">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Lifecycle stage (GD Level) — ≤50 used cars</p>
                          <StageBucketBreakdown stageMap={smbStageLe50} />
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
                  <td className="px-4 py-2">Total SMB</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatNumber(cell.franchise)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatNumber(cell.independent)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatNumber(cell.rooftops)}</td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-2 text-xs italic text-slate-400">All are single dealers (no group)</td>
                  <td colSpan={3} className="px-4 py-2 text-right text-xs text-slate-400">
                    {((frGt50 + indGt50) / (cell.rooftops || 1) * 100).toFixed(1)}% have &gt;50 cars
                  </td>
                </tr>
              </>
            ) : (
              <tr className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-800">All SMB dealers</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-700">{formatNumber(cell.franchise)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-700">{formatNumber(cell.independent)}</td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-950">{formatNumber(cell.rooftops)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function InsightList({
  title,
  rows,
  excludePlaceholders = false,
}: {
  title: string
  rows: GroupRow[]
  excludePlaceholders?: boolean
}) {
  const total = rows.reduce((sum, row) => sum + row.rooftops, 0)
  const visibleRows = topRows(rows, 5, { excludePlaceholders })

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-950">{title}</h3>
        <span className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500">Top 5</span>
      </div>
      <div className="mt-5 space-y-4">
        {visibleRows.map((row) => {
          const share = total ? (row.rooftops / total) * 100 : 0

          return (
            <div key={row.label} className="grid grid-cols-[minmax(120px,0.34fr)_minmax(0,1fr)_80px] items-center gap-3">
              <span className="truncate text-sm font-medium text-slate-700">{row.label}</span>
              <div className="h-5 overflow-hidden rounded-md bg-slate-100">
                <div
                  className="flex h-full items-center justify-end rounded-md bg-gradient-to-r from-blue-600 to-sky-400 pr-2 text-[11px] font-semibold text-white"
                  style={{ width: `${Math.max(Math.min(share, 100), 4)}%` }}
                >
                  {share.toFixed(0)}%
                </div>
              </div>
              <span className="text-right text-sm font-semibold text-slate-950">{formatNumber(row.rooftops)}</span>
            </div>
          )
        })}
      </div>
    </article>
  )
}

function RiskFlags({ rows, relevantTotal }: { rows: GroupRow[]; relevantTotal: number }) {
  const riskRows = topRows(rows, 5)

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-950">Risk Flags</h3>
        <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
          {riskRows.length} active
        </span>
      </div>
      <div className="mt-5 space-y-3">
        {riskRows.map((row, index) => {
          const priority = index < 2 ? 'Critical' : index < 4 ? 'High' : 'Monitor'
          const color =
            index < 2
              ? 'border-red-200 bg-red-50 text-red-700'
              : index < 4
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-slate-200 bg-slate-50 text-slate-600'

          return (
            <div key={row.label} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${color}`}>
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <span className="h-2 w-2 flex-shrink-0 rounded-full bg-current" />
                <span className="truncate text-slate-800">
                  {row.label} missing on {formatNumber(row.rooftops)} rooftops
                </span>
              </div>
              <span className="whitespace-nowrap rounded-md bg-white/70 px-2 py-1 text-xs font-semibold uppercase">
                {priority} · {formatPercent(row.rooftops, relevantTotal)}
              </span>
            </div>
          )
        })}
      </div>
    </article>
  )
}

function SectionHeader({
  id,
  icon,
  title,
  description,
}: {
  id: string
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div id={id} className="scroll-mt-36">
      <div className="mb-4 flex items-start gap-3">
        <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-md bg-slate-950 text-white">
          {icon}
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
    </div>
  )
}

function DashboardContent() {
  const { data, loading, error } = useDashboardData()
  const { status } = useSyncStatus()
  const { filteredData, filters, setFilter, resetFilters } = useFilters(data)
  const [drilldown, setDrilldown] = useState<DrilldownModalState | null>(null)

  const handleRefresh = async () => {
    try {
      await fetch('/api/trigger-sync', {
        method: 'POST',
        headers: {
          'X-Dashboard-Secret': process.env.NEXT_PUBLIC_DASHBOARD_SECRET || '',
        },
      })
    } catch (error) {
      console.error('Failed to trigger sync:', error)
    }
  }

  const derived = useMemo(() => {
    if (!filteredData) return null

    const relevant = filteredData.summaries.relevantTAM
    const topFiveStates = topRows(filteredData.breakdowns.byState)
    const topFiveStateShare = topFiveStates.reduce((sum, row) => sum + row.rooftops, 0)
    const missingRows = buildMissingFieldRows(filteredData.relevantRecords)
    const noTeam = findRow(missingRows, 'HubSpot Team') ?? { key: 'tm', label: 'HubSpot Team', rooftops: 0, companies: 0 }
    const noCrm = findRow(missingRows, 'CRM Platform') ?? { key: 'cp', label: 'CRM Platform', rooftops: 0, companies: 0 }

    return {
      topFiveStates,
      topFiveStateShare,
      missingRows,
      noTeam,
      noCrm,
      relevant,
    }
  }, [filteredData])

  // Per-market figures: groups (canonical), rooftops (records), and the Franchise vs
  // Independent split WITHIN those rooftops (by each record's dealership type).
  const seg = useMemo(() => {
    if (!filteredData) return null
    type Cell = { groups: number; gfdGroups: number; igdGroups: number; rooftops: number; franchise: number; independent: number }
    const cell = (): Cell => ({ groups: 0, gfdGroups: 0, igdGroups: 0, rooftops: 0, franchise: 0, independent: 0 })
    const M = {
      SMB: cell(), MM_SINGLE: cell(), MM_GROUP: cell(),
      ENT_A: cell(), ENT_B: cell(), ENT_C: cell(), TOP_150: cell(), UNSIZED: cell(),
    }
    type Bucket = keyof typeof M
    const bucketOf = (sg: string | null): Bucket | undefined =>
      sg === 'SMB' ? 'SMB'
        : sg === 'MM_SINGLE' ? 'MM_SINGLE'
          : sg === 'MM_GROUP' ? 'MM_GROUP'
            : sg === 'ENT_A' ? 'ENT_A' : sg === 'ENT_B' ? 'ENT_B' : sg === 'ENT_C' ? 'ENT_C'
              : sg === 'TOP_150' ? 'TOP_150'
                : sg === 'UNSIZED' ? 'UNSIZED' : undefined

    const mkMarket = () => ({ franchise: 0, independent: 0 })
    type PodStatInternal = PodStat & { _companySet: Set<string> }
    const podStats: PodStatInternal[] = PODS.map(() => ({
      companies: 0, rooftops: 0,
      markets: { smb: mkMarket(), mm: mkMarket(), ent: mkMarket(), unsized: mkMarket() },
      _companySet: new Set(),
    }))
    // Per-pod breakdown for each bucket.
    const BUCKET_KEYS = ['SMB', 'MM_SINGLE', 'MM_GROUP', 'ENT_A', 'ENT_B', 'ENT_C', 'TOP_150'] as const
    type BucketKey = typeof BUCKET_KEYS[number]
    const podByBucket: Record<BucketKey, Array<{ franchise: number; independent: number }>> =
      Object.fromEntries(BUCKET_KEYS.map((k) => [k, PODS.map(() => mkMarket())])) as Record<BucketKey, Array<{ franchise: number; independent: number }>>
    // Per-stage (lv = GD Level) breakdown for each bucket — for the Stages toggle.
    type StageEntry = { franchise: number; independent: number }
    type StageBucket = Record<string, StageEntry>
    const stageByBucket: Record<BucketKey, StageBucket> = {
      SMB: {}, MM_SINGLE: {}, MM_GROUP: {}, ENT_A: {}, ENT_B: {}, ENT_C: {}, TOP_150: {},
    }

    for (const r of filteredData.relevantRecords) {
      const bk = bucketOf(r.sg)
      if (bk) {
        const c = M[bk]
        c.rooftops++
        if (r.td === 'Franchise') c.franchise++
        else if (r.td === 'Independent') c.independent++
      }
      // Pod attribution by owner.
      const podIdx = r.ow != null ? OWNER_TO_POD[r.ow] : undefined
      if (podIdx !== undefined) {
        const ps = podStats[podIdx]
        ps.rooftops++
        if (r.gi || r.oi) ps._companySet.add((r.gi || r.oi) as string)
        else ps.companies++
        const mk = marketOf(r.sg)
        if (mk) {
          if (r.td === 'Franchise') ps.markets[mk].franchise++
          else if (r.td === 'Independent') ps.markets[mk].independent++
        }
        // Accumulate per-pod per-bucket counts for card pod-breakdown footers.
        if (bk && bk !== 'UNSIZED') {
          const pb = podByBucket[bk as BucketKey]
          if (r.td === 'Franchise') pb[podIdx].franchise++
          else if (r.td === 'Independent') pb[podIdx].independent++
        }
      }
      // Accumulate per-stage per-bucket counts for Stages toggle.
      if (bk && bk !== 'UNSIZED') {
        const stageKey = r.lv ?? '(No value)'
        const sm: Record<string, StageEntry> = stageByBucket[bk as BucketKey]
        if (!sm[stageKey]) sm[stageKey] = { franchise: 0, independent: 0 }
        if (r.td === 'Franchise') sm[stageKey].franchise++
        else if (r.td === 'Independent') sm[stageKey].independent++
      }
    }
    
    for (const ps of podStats) {
      ps.companies += ps._companySet.size
    }
    // Group counts + GFD/IGD split — canonical from dealer-group list.
    for (const g of filteredData.segmentation.groups ?? []) {
      const isFr = g.type === 'GFD'
      const tgt =
        g.segment === 'MM_GROUP' ? M.MM_GROUP
          : g.segment === 'ENT_A' ? M.ENT_A
            : g.segment === 'ENT_B' ? M.ENT_B
              : g.segment === 'ENT_C' ? M.ENT_C
                : g.segment === 'TOP_150' ? M.TOP_150
                  : null
      if (tgt) { tgt.groups++; if (isFr) tgt.gfdGroups++; else tgt.igdGroups++ }
    }

    const add = (...cs: Cell[]): Cell => ({
      groups:     cs.reduce((s, c) => s + c.groups,     0),
      gfdGroups:  cs.reduce((s, c) => s + c.gfdGroups,  0),
      igdGroups:  cs.reduce((s, c) => s + c.igdGroups,  0),
      rooftops:   cs.reduce((s, c) => s + c.rooftops,   0),
      franchise:  cs.reduce((s, c) => s + c.franchise,  0),
      independent:cs.reduce((s, c) => s + c.independent,0),
    })
    const mmSub = add(M.MM_SINGLE, M.MM_GROUP)
    const entSub = add(M.ENT_A, M.ENT_B, M.ENT_C)
    const row = (label: string, c: Cell, opts: { showGroups: boolean; kind?: MatrixRow['kind']; indent?: boolean }): MatrixRow =>
      ({ label, groups: c.groups, rooftops: c.rooftops, franchise: c.franchise, independent: c.independent, showGroups: opts.showGroups, kind: opts.kind ?? 'segment', indent: opts.indent })
    const rows: MatrixRow[] = [
      row('SMB — independent single ≤100 cars', M.SMB, { showGroups: false }),
      row('Mid Market', mmSub, { showGroups: true, kind: 'subtotal' }),
      row('Single · 1 rooftop (all Franchise + Ind >100 cars)', M.MM_SINGLE, { showGroups: false, indent: true }),
      row('Group · 2–6 rooftops', M.MM_GROUP, { showGroups: true, indent: true }),
      row('Enterprise', entSub, { showGroups: true, kind: 'subtotal' }),
      row('Enterprise-A · 7–10 rooftops', M.ENT_A, { showGroups: true, indent: true }),
      row('Enterprise-B · 11–15 rooftops', M.ENT_B, { showGroups: true, indent: true }),
      row('Enterprise-C · 16+ rooftops', M.ENT_C, { showGroups: true, indent: true }),
      row('Top 150 · US base (see card for all regions)', M.TOP_150, { showGroups: true }),
      row('Unsized — no car data', M.UNSIZED, { showGroups: false }),
      row('Total classified', add(M.SMB, mmSub, entSub, M.TOP_150), { showGroups: true, kind: 'total' }),
    ]
    // Aggregate per-pod for the two "Total" cards.
    const podByBucketAgg = (keys: BucketKey[]) =>
      PODS.map((_, i) => ({
        franchise: keys.reduce((s, k) => s + podByBucket[k][i].franchise, 0),
        independent: keys.reduce((s, k) => s + podByBucket[k][i].independent, 0),
      }))
    const podMM_ALL = podByBucketAgg(['MM_SINGLE', 'MM_GROUP'])
    const podENT_ALL = podByBucketAgg(['ENT_A', 'ENT_B', 'ENT_C'])

    // Aggregate stage maps for MM_ALL and ENT_ALL.
    const mergeStages = (keys: BucketKey[]): Record<string, StageEntry> => {
      const out: Record<string, StageEntry> = {}
      for (const k of keys) {
        for (const [stage, cnt] of Object.entries(stageByBucket[k])) {
          if (!out[stage]) out[stage] = { franchise: 0, independent: 0 }
          out[stage].franchise += cnt.franchise; out[stage].independent += cnt.independent
        }
      }
      return out
    }
    const stageMM_ALL = mergeStages(['MM_SINGLE', 'MM_GROUP'])
    const stageENT_ALL = mergeStages(['ENT_A', 'ENT_B', 'ENT_C'])

    return { M, rows, podStats, podByBucket, podMM_ALL, podENT_ALL, stageByBucket, stageMM_ALL, stageENT_ALL, mmSub, entSub }
  }, [filteredData])

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-5">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-700" />
            <div>
              <h1 className="font-semibold text-red-950">Error Loading Dashboard</h1>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (loading || !data || !filteredData || !derived || !seg) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-[1680px]">
          <div className="h-8 w-72 rounded-md bg-slate-200" />
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-36 animate-pulse rounded-lg border border-slate-200 bg-white" />
            ))}
          </div>
        </div>
      </main>
    )
  }

  const { summaries, breakdowns, stateTeamMatrix, segmentation } = filteredData
  const relevantTotal = summaries.relevantTAM.rooftops
  // Top-150 spans all regions (computed at sync, region-independent). Fallback for old blobs.
  const t150 = segmentation.top150AllRegions ?? { rooftops: 0, companies: 0, franchise: 0, independent: 0 }
  const lastSynced = filteredData.fetchedAt
    ? new Date(filteredData.fetchedAt).toLocaleString()
    : 'Unknown'
  const openBreakdownDrilldown = (
    reportTitle: string,
    config: BreakdownDrilldownConfig,
    row: GroupRow,
    measure: DrilldownMeasure
  ) => {
    const records = filteredData.relevantRecords.filter((record) => (
      hasKnownDomain(record) &&
      segmentValue(record, config.field) === row.key &&
      (!config.predicate || config.predicate(record))
    ))

    setDrilldown({
      reportTitle,
      segmentLabel: row.label,
      segmentColumn: config.segmentColumn,
      measure,
      records,
    })
  }
  const openStateTeamDrilldown = (
    state: string,
    teamId: string,
    teamName: string,
    measure: DrilldownMeasure
  ) => {
    const records = filteredData.relevantRecords.filter((record) => (
      hasKnownDomain(record) &&
      (record.st ?? NO_VALUE) === state &&
      (record.tm ?? NO_VALUE) === teamId
    ))

    setDrilldown({
      reportTitle: 'State-Team Wise Relevant TAM',
      segmentLabel: `${state} / ${teamName}`,
      segmentColumn: 'State / Team',
      measure,
      records,
    })
  }
  // Pod cell drilldown: companies owned by a pod's members, in a market, by type.
  const openPodDrilldown = (podIndex: number, market: Market | null, type: 'Franchise' | 'Independent' | null) => {
    const pod = PODS[podIndex]
    const records = filteredData.relevantRecords.filter((r) =>
      r.ow != null && OWNER_TO_POD[r.ow] === podIndex &&
      (market === null || marketOf(r.sg) === market) &&
      (type === null || r.td === type)
    )
    setDrilldown({
      reportTitle: `${pod.lead} — Pod`,
      segmentLabel: `${market ? MARKET_LABEL[market] : 'All markets'}${type ? ` · ${type}` : ''}`,
      segmentColumn: 'Pod / Market',
      measure: 'rooftops',
      records,
    })
  }

  // Pod bucket drilldown: filter by a specific segment bucket (SMB / MM_SINGLE / etc.) per pod.
  type BucketPred = (r: MinifiedRecord) => boolean
  const BUCKET_PRED: Record<string, BucketPred> = {
    SMB:       (r) => r.sg === 'SMB',
    MM_SINGLE: (r) => r.sg === 'MM_SINGLE',
    MM_GROUP:  (r) => r.sg === 'MM_GROUP',
    MM_ALL:    (r) => r.sg === 'MM_SINGLE' || r.sg === 'MM_GROUP',
    ENT_A:     (r) => r.sg === 'ENT_A',
    ENT_B:     (r) => r.sg === 'ENT_B',
    ENT_C:     (r) => r.sg === 'ENT_C',
    ENT_ALL:   (r) => r.sg === 'ENT_A' || r.sg === 'ENT_B' || r.sg === 'ENT_C',
    TOP_150:   (r) => r.sg === 'TOP_150',
  }
  const podBucketDrilldown = (bucketKey: string, title: string) =>
    (podIdx: number, type: 'Franchise' | 'Independent' | null) => {
      const bucketPred = BUCKET_PRED[bucketKey]
      if (!bucketPred) return
      const pod = PODS[podIdx]
      const records = filteredData.relevantRecords.filter((r) =>
        r.ow != null && OWNER_TO_POD[r.ow] === podIdx &&
        bucketPred(r) &&
        (type === null || r.td === type)
      )
      setDrilldown({
        reportTitle: `${pod.lead} — ${title}`,
        segmentLabel: type ?? 'All types',
        segmentColumn: 'Pod',
        measure: 'rooftops',
        records,
      })
    }

  return (
    <div className="min-h-screen bg-[#eef1f7] text-slate-950">
      <Sidebar />
      <div className="min-w-0 lg:pl-[264px]">
        <TopBar lastSynced={lastSynced} metricCount={summaries.relevantTAM.rooftops} />
        <main className="mx-auto max-w-[1680px] space-y-8 px-6 py-8">
          <section className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Real-time metrics from HubSpot company records</p>
              <h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold tracking-normal text-slate-950">
                <a
                  href={hubspotReportLinks.dashboard}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 hover:text-blue-700"
                >
                  TAM Distribution Dashboard
                  <ExternalLink className="h-5 w-5" />
                </a>
              </h1>
            </div>
          </section>

          <FilterBar
            filters={filters}
            setFilter={setFilter}
            resetFilters={resetFilters}
            filterOptions={data.filterOptions}
            onRefresh={handleRefresh}
            syncing={status.status === 'syncing'}
          />

        <SyncStatusBanner status={status} />

        <section>
          <SectionHeader
            id="overview"
            icon={<Building2 className="h-4 w-4" />}
            title="Executive Overview"
            description="The first-pass answer to market size, segment mix, and data quality risk after the selected filters are applied."
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Relevant TAM"
              metric={summaries.relevantTAM}
              helper="Filtered rooftops where website status is Relevant."
              reportHref={hubspotReportLinks.relevantTam}
            />
            <MetricCard
              title="Franchise TAM"
              metric={summaries.franchiseTAM}
              denominator={relevantTotal}
              helper="Strategic rooftops with larger average group concentration."
              reportHref={hubspotReportLinks.franchiseTam}
            />
            <MetricCard
              title="Independent TAM"
              metric={summaries.independentTAM}
              denominator={relevantTotal}
              helper="Largest addressable segment by rooftop count."
              reportHref={hubspotReportLinks.independentTam}
            />
            <MetricCard
              title="Without Domains"
              metric={summaries.withoutDomains}
              denominator={relevantTotal}
              tone="risk"
              helper="Data gap that can slow enrichment, outreach, and matching."
              reportHref={hubspotReportLinks.withoutDomains}
            />
            <MetricCard
              title="Contract Closed"
              metric={summaries.contractClosed}
              denominator={relevantTotal}
              tone="success"
              helper="Known-domain relevant TAM at GD Level = Contract Closed."
              reportHref={hubspotReportLinks.contractClosed}
            />
            <MetricCard
              title="Carsforsale.com"
              metric={summaries.carsforsale}
              denominator={relevantTotal}
              helper="Carsforsale.Com rooftops inside the relevant known-domain TAM."
              reportHref={hubspotReportLinks.carsforsale}
            />
            <MetricCard
              title="No Team Assigned"
              metric={derived.noTeam}
              denominator={relevantTotal}
              tone="risk"
              helper="Ownership gap inside the filtered Relevant TAM."
            />
            <MetricCard
              title="No CRM Captured"
              metric={derived.noCrm}
              denominator={relevantTotal}
              tone="risk"
              helper="Vendor-data gap that limits segmentation confidence."
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-4">
            <InsightList title="Top States" rows={breakdowns.byState} />
            <InsightList title="Top CRMs" rows={breakdowns.byCrmPlatform} excludePlaceholders />
            <InsightList title="Top Teams" rows={breakdowns.byTeam} excludePlaceholders />
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-950">Market Concentration</h3>
              <p className="mt-4 text-3xl font-bold text-slate-950">
                {formatPercent(derived.topFiveStateShare, relevantTotal)}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                of filtered Relevant TAM sits in the top five states.
              </p>
              <a href="#geography" className="mt-4 flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900">
                Review geography <ArrowUpRight className="h-4 w-4" />
              </a>
            </article>
          </div>
        </section>

        <section>
          <SectionHeader
            id="segmentation"
            icon={<Boxes className="h-4 w-4" />}
            title="TAM Segmentation (AOP)"
            description="Spyne's RevOps framework split: single dealers sized by used-car count (SMB ≤100 / Mid Market >100); dealer groups sized by rooftop count and Top-150 rank (Mid Market ≤10, Enterprise-A 11–15, Enterprise-B 16+, Enterprise-C = Top 150). Counts cover the filtered Relevant TAM."
          />
          {!segmentation.available ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-sm">
              <p className="font-semibold">Segmentation awaits a fresh sync.</p>
              <p className="mt-1 leading-6">
                The currently loaded data predates the AOP segmentation fields. Click
                <span className="font-medium"> Refresh data</span> (or run the HubSpot sync) to populate
                used-car counts, dealer-group names, and Top-150 ranks.
              </p>
            </div>
          ) : (
            <>
              {/* Row 1 — Mid Market: Total + Single + Group (2-6) */}
              <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  title="Mid Market — Total"
                  metric={ZERO_METRIC}
                  accounts={seg.M.MM_SINGLE.rooftops + seg.M.MM_GROUP.groups}
                  accountsUnit=""
                  subtitle={`${formatNumber(seg.mmSub.rooftops)} rooftops · ${formatNumber(seg.M.MM_SINGLE.rooftops)} single + ${formatNumber(seg.M.MM_GROUP.groups)} groups`}
                  rows={[
                    { label: 'Total rooftops', franchise: seg.mmSub.franchise, independent: seg.mmSub.independent },
                    { label: 'Single rooftops', franchise: seg.M.MM_SINGLE.franchise, independent: seg.M.MM_SINGLE.independent, indent: true },
                    { label: 'Group rooftops (2–6)', franchise: seg.M.MM_GROUP.franchise, independent: seg.M.MM_GROUP.independent, indent: true },
                    { label: 'Groups (2–6)', franchise: seg.M.MM_GROUP.gfdGroups, independent: seg.M.MM_GROUP.igdGroups },
                  ]}
                  helper="All franchise singles + independent singles >100 cars + dealer groups (2–6 rooftops). Groups with 7+ rooftops are Enterprise."
                  footer={<CardFooter podCounts={seg.podMM_ALL} totalRooftops={seg.mmSub.rooftops} stageMap={seg.stageMM_ALL} onPodRowClick={podBucketDrilldown('MM_ALL', 'Mid Market — Total')} />}
                />
                <MetricCard
                  title="Mid Market — Single"
                  metric={segmentation.bySegment.MM_SINGLE}
                  denominator={relevantTotal}
                  split={seg.M.MM_SINGLE}
                  helper="Single-location dealers: all franchise, plus independents with >100 used cars (1 rooftop)."
                  footer={<CardFooter podCounts={seg.podByBucket.MM_SINGLE} totalRooftops={seg.M.MM_SINGLE.rooftops} stageMap={seg.stageByBucket.MM_SINGLE} onPodRowClick={podBucketDrilldown('MM_SINGLE', 'MM — Single')} />}
                />
                <MetricCard
                  title="Mid Market — Group (2–6)"
                  metric={ZERO_METRIC}
                  accounts={seg.M.MM_GROUP.groups}
                  split={seg.M.MM_GROUP}
                  groupSplit={{ franchise: seg.M.MM_GROUP.gfdGroups, independent: seg.M.MM_GROUP.igdGroups }}
                  helper="Dealer groups with 2–6 rooftops."
                  footer={<CardFooter podCounts={seg.podByBucket.MM_GROUP} totalRooftops={seg.M.MM_GROUP.rooftops} stageMap={seg.stageByBucket.MM_GROUP} onPodRowClick={podBucketDrilldown('MM_GROUP', 'MM — Group (2–6)')}
                    rooftopPanel={<MMRooftopCountTable groups={(segmentation.groups ?? []) as DealerGroupFull[]} mmRooftopPodSplit={segmentation.mmRooftopPodSplit} range={[2, 6]} compact />} />}
                />
              </div>

              {/* Row 2 — Enterprise: Total + A (7-10) + B (11-15) + C (16+) */}
              <div className="mt-4 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  title="Enterprise — Total"
                  metric={ZERO_METRIC}
                  accounts={seg.M.ENT_A.groups + seg.M.ENT_B.groups + seg.M.ENT_C.groups}
                  accountsUnit="groups"
                  split={seg.entSub}
                  groupSplit={{ franchise: seg.entSub.gfdGroups, independent: seg.entSub.igdGroups }}
                  helper="Groups with 7+ rooftops (Enterprise A/B/C). Top-150 groups are shown separately."
                  footer={<CardFooter podCounts={seg.podENT_ALL} totalRooftops={seg.entSub.rooftops} stageMap={seg.stageENT_ALL} onPodRowClick={podBucketDrilldown('ENT_ALL', 'Enterprise — Total')} />}
                />
                <MetricCard
                  title="Enterprise-A"
                  metric={ZERO_METRIC}
                  accounts={seg.M.ENT_A.groups}
                  split={seg.M.ENT_A}
                  groupSplit={{ franchise: seg.M.ENT_A.gfdGroups, independent: seg.M.ENT_A.igdGroups }}
                  helper="Groups with 7–10 rooftops."
                  footer={<CardFooter podCounts={seg.podByBucket.ENT_A} totalRooftops={seg.M.ENT_A.rooftops} stageMap={seg.stageByBucket.ENT_A} onPodRowClick={podBucketDrilldown('ENT_A', 'Enterprise-A')} />}
                />
                <MetricCard
                  title="Enterprise-B"
                  metric={ZERO_METRIC}
                  accounts={seg.M.ENT_B.groups}
                  split={seg.M.ENT_B}
                  groupSplit={{ franchise: seg.M.ENT_B.gfdGroups, independent: seg.M.ENT_B.igdGroups }}
                  helper="Groups with 11–15 rooftops."
                  footer={<CardFooter podCounts={seg.podByBucket.ENT_B} totalRooftops={seg.M.ENT_B.rooftops} stageMap={seg.stageByBucket.ENT_B} onPodRowClick={podBucketDrilldown('ENT_B', 'Enterprise-B')} />}
                />
                <MetricCard
                  title="Enterprise-C"
                  metric={ZERO_METRIC}
                  accounts={seg.M.ENT_C.groups}
                  split={seg.M.ENT_C}
                  groupSplit={{ franchise: seg.M.ENT_C.gfdGroups, independent: seg.M.ENT_C.igdGroups }}
                  helper="Groups with 16+ rooftops (excluding Top 150)."
                  footer={<CardFooter podCounts={seg.podByBucket.ENT_C} totalRooftops={seg.M.ENT_C.rooftops} stageMap={seg.stageByBucket.ENT_C} onPodRowClick={podBucketDrilldown('ENT_C', 'Enterprise-C')} />}
                />
              </div>

              {/* Row 3 — Top 150 (all regions) + SMB + Unsized */}
              <div className="mt-4 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  title="Top 150"
                  metric={ZERO_METRIC}
                  accounts={seg.M.TOP_150.groups}
                  accountsUnit="groups"
                  split={{ rooftops: t150.rooftops, franchise: t150.franchise, independent: t150.independent }}
                  groupSplit={{ franchise: seg.M.TOP_150.gfdGroups, independent: seg.M.TOP_150.igdGroups }}
                  tone="success"
                  subtitle={`${formatNumber(t150.rooftops)} rooftops · all regions`}
                  helper="Top-150 strategic dealer groups (Dealership Rank = Top 150). Counted across ALL regions, any website status; rooftop split is global."
                  footer={<CardFooter podCounts={seg.podByBucket.TOP_150} totalRooftops={seg.M.TOP_150.rooftops} stageMap={seg.stageByBucket.TOP_150} onPodRowClick={podBucketDrilldown('TOP_150', 'Top 150')} />}
                />
                <MetricCard
                  title="SMB"
                  metric={segmentation.bySegment.SMB}
                  denominator={relevantTotal}
                  split={seg.M.SMB}
                  helper="Single-location independent dealers with ≤100 used cars (all franchise singles are Mid Market)."
                  footer={<CardFooter podCounts={seg.podByBucket.SMB} totalRooftops={seg.M.SMB.rooftops} stageMap={seg.stageByBucket.SMB} onPodRowClick={podBucketDrilldown('SMB', 'SMB')} />}
                />
                <MetricCard
                  title="Unsized"
                  metric={segmentation.bySegment.UNSIZED}
                  denominator={relevantTotal}
                  split={seg.M.UNSIZED}
                  tone="risk"
                  helper="Single dealers missing a used-car count — enrich to classify."
                />
              </div>

              <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <SegmentMatrixTable rows={seg.rows} />
                <DealerGroupTable groups={segmentation.groups ?? []} />
              </div>

              {/* MM rooftop-count deep-dive table */}
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <MMRooftopCountTable
                  groups={(segmentation.groups ?? []) as DealerGroupFull[]}
                  mmRooftopPodSplit={segmentation.mmRooftopPodSplit}
                />
                <SMBDeepDive
                  cell={seg.M.SMB}
                  smbGt50={segmentation.smbGt50}
                  smbPodGt50={segmentation.smbPodGt50}
                  smbPodLe50={segmentation.smbPodLe50}
                  smbStageGt50={segmentation.smbStageGt50}
                  smbStageLe50={segmentation.smbStageLe50}
                  onPodRowClick={podBucketDrilldown('SMB', 'SMB')}
                />
              </div>
            </>
          )}
        </section>

        <section>
          <SectionHeader
            id="pods"
            icon={<Users2 className="h-4 w-4" />}
            title="Pod View"
            description="Companies assigned to each sales pod (by company owner), with the Franchise vs Independent split per market segment. Counts cover the filtered Relevant TAM."
          />
          {seg.podStats.reduce((a, s) => a + s.rooftops, 0) === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-sm">
              <p className="font-semibold">Pod data awaits a fresh sync.</p>
              <p className="mt-1 leading-6">
                The loaded data predates the company-owner field used to map accounts to pods. Click
                <span className="font-medium"> Refresh data</span> (or run the HubSpot sync) to populate it.
              </p>
            </div>
          ) : (
            <PodView pods={PODS} stats={seg.podStats} onCellClick={openPodDrilldown} />
          )}
        </section>

        <section>
          <SectionHeader
            id="market"
            icon={<Layers3 className="h-4 w-4" />}
            title="Market Segments"
            description="Segment the TAM by dealership type, org tier, CRM, and lifecycle so leaders can compare opportunity quality, not just volume."
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <BreakdownTable
              title="Size Wise Relevant TAM"
              rows={breakdowns.byOrgTier}
              reportHref={hubspotReportLinks.sizeWise}
              onDrilldown={(row, measure) => openBreakdownDrilldown('Size Wise Relevant TAM', drilldownConfigs.orgTier, row, measure)}
            />
            <BreakdownTable
              title="Dealership Type Wise Relevant TAM"
              rows={breakdowns.byDealershipType}
              reportHref={hubspotReportLinks.dealershipTypeWise}
              onDrilldown={(row, measure) => openBreakdownDrilldown('Dealership Type Wise Relevant TAM', drilldownConfigs.dealershipType, row, measure)}
            />
            <BreakdownTable
              title="Franchise CRM Wise TAM"
              rows={breakdowns.franchiseByCrm}
              reportHref={hubspotReportLinks.franchiseCrmWise}
              onDrilldown={(row, measure) => openBreakdownDrilldown('Franchise CRM Wise TAM', drilldownConfigs.franchiseCrm, row, measure)}
            />
            <BreakdownTable
              title="Independent CRM Wise TAM"
              rows={breakdowns.independentByCrm}
              reportHref={hubspotReportLinks.independentCrmWise}
              onDrilldown={(row, measure) => openBreakdownDrilldown('Independent CRM Wise TAM', drilldownConfigs.independentCrm, row, measure)}
            />
            <BreakdownTable
              title="Franchise Stage Wise TAM"
              rows={breakdowns.franchiseByLifecycle}
              reportHref={hubspotReportLinks.franchiseStageWise}
              onDrilldown={(row, measure) => openBreakdownDrilldown('Franchise Stage Wise TAM', drilldownConfigs.franchiseStage, row, measure)}
            />
            <BreakdownTable
              title="Independent Stage Wise TAM"
              rows={breakdowns.independentByLifecycle}
              reportHref={hubspotReportLinks.independentStageWise}
              onDrilldown={(row, measure) => openBreakdownDrilldown('Independent Stage Wise TAM', drilldownConfigs.independentStage, row, measure)}
            />
          </div>
        </section>

        <section>
          <SectionHeader
            id="geography"
            icon={<Map className="h-4 w-4" />}
            title="Geography"
            description="Show where addressable rooftops are concentrated and how state-level ownership is distributed across teams."
          />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
            <BreakdownTable
              title="State Wise Relevant TAM"
              rows={breakdowns.byState}
              maxRows={12}
              reportHref={hubspotReportLinks.stateWise}
              onDrilldown={(row, measure) => openBreakdownDrilldown('State Wise Relevant TAM', drilldownConfigs.state, row, measure)}
            />
            <CrossTabTable
              matrix={stateTeamMatrix}
              reportHref={hubspotReportLinks.stateTeamWise}
              onDrilldown={openStateTeamDrilldown}
            />
          </div>
        </section>

        <section>
          <SectionHeader
            id="systems"
            icon={<Database className="h-4 w-4" />}
            title="Systems & Vendors"
            description="Inspect CRM, DMS, competitor, and partnership concentration for ecosystem strategy and campaign targeting."
          />
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <BreakdownTable
              title="CRM Wise Relevant TAM"
              rows={breakdowns.byCrmPlatform}
              reportHref={hubspotReportLinks.crmWise}
              onDrilldown={(row, measure) => openBreakdownDrilldown('CRM Wise Relevant TAM', drilldownConfigs.crm, row, measure)}
            />
            <BreakdownTable
              title="Competitor Wise Relevant TAM"
              rows={breakdowns.byCompetitor}
              reportHref={hubspotReportLinks.competitorWise}
              onDrilldown={(row, measure) => openBreakdownDrilldown('Competitor Wise Relevant TAM', drilldownConfigs.competitor, row, measure)}
            />
            <BreakdownTable
              title="Partnership Wise Relevant TAM"
              rows={breakdowns.byPartner}
              reportHref={hubspotReportLinks.partnershipWise}
              onDrilldown={(row, measure) => openBreakdownDrilldown('Partnership Wise Relevant TAM', drilldownConfigs.partnership, row, measure)}
            />
          </div>
        </section>

        <section>
          <SectionHeader
            id="ownership"
            icon={<Users2 className="h-4 w-4" />}
            title="GTM Ownership"
            description="Track how the filtered TAM maps to teams and lifecycle stages so business leaders can see coverage and pipeline maturity."
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <BreakdownTable
              title="Team Wise Relevant TAM"
              rows={breakdowns.byTeam}
              reportHref={hubspotReportLinks.teamWise}
              onDrilldown={(row, measure) => openBreakdownDrilldown('Team Wise Relevant TAM', drilldownConfigs.team, row, measure)}
            />
            <BreakdownTable
              title="Lifecycle Stage Wise Relevant TAM"
              rows={breakdowns.byLifecycleStage}
              reportHref={hubspotReportLinks.lifecycleStageWise}
              onDrilldown={(row, measure) => openBreakdownDrilldown('Lifecycle Stage Wise Relevant TAM', drilldownConfigs.lifecycle, row, measure)}
            />
          </div>
        </section>

        <section>
          <SectionHeader
            id="quality"
            icon={<ShieldAlert className="h-4 w-4" />}
            title="Data Quality"
            description="Expose missing-field risk directly so the business team can separate true market insights from CRM hygiene gaps."
          />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1.4fr)]">
            <article className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <ShieldAlert className="h-4 w-4" />
                Highest Data Gap
              </div>
              <p className="mt-4 text-3xl font-bold text-slate-950">
                {derived.missingRows[0]?.label ?? 'None'}
              </p>
              <p className="mt-2 text-sm leading-6 text-amber-900">
                {formatNumber(derived.missingRows[0]?.rooftops ?? 0)} rooftops are missing this value.
              </p>
              <div className="mt-5 rounded-md bg-white p-3 text-sm text-slate-700 ring-1 ring-amber-200">
                Data quality is calculated from filtered Relevant TAM records and updates with every filter change.
              </div>
            </article>
            <RiskFlags rows={derived.missingRows} relevantTotal={relevantTotal} />
            <BreakdownTable title="Missing Field Audit" rows={derived.missingRows} maxRows={12} />
          </div>
        </section>
        </main>
      </div>
      {drilldown && (
        <DrilldownModal
          open={Boolean(drilldown)}
          reportTitle={drilldown.reportTitle}
          segmentLabel={drilldown.segmentLabel}
          segmentColumn={drilldown.segmentColumn}
          measure={drilldown.measure}
          records={drilldown.records}
          onClose={() => setDrilldown(null)}
        />
      )}
    </div>
  )
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-600">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  )
}
