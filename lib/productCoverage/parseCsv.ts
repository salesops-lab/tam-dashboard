// RFC4180-ish CSV parser + row mapper for the Product / Account Coverage
// second dataset. Deliberately standalone — does not touch lib/hubspot or
// lib/aggregation, which remain the existing TAM dataset's pipeline.

import type { ProductCoverageRecord } from '@/types/productCoverage'
import { normalizeCountry, normalizeState } from './normalize'

function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch === '\r') {
      // skip; \n handles the row break
    } else {
      field += ch
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function parseGeoCoordinates(raw: string): { lat: number | null; lng: number | null } {
  if (!raw) return { lat: null, lng: null }
  try {
    const parsed = JSON.parse(raw)
    const lat = typeof parsed.lat === 'number' ? parsed.lat : null
    const lng = typeof parsed.lng === 'number' ? parsed.lng : null
    return { lat, lng }
  } catch {
    return { lat: null, lng: null }
  }
}

export function parseProductCoverageCsv(text: string): ProductCoverageRecord[] {
  const rows = parseCsvText(text)
  if (rows.length === 0) return []

  const headers = rows[0].map((h) => h.trim())
  const idx = (name: string) => headers.indexOf(name)

  const col = {
    rooftopId: idx('rooftop_id'),
    enterpriseId: idx('enterprise_id'),
    rooftopName: idx('rooftop_name'),
    enterpriseName: idx('enterprise_name'),
    csmPoc: idx('csm_poc'),
    productStage: idx('Product Stage'),
    city: idx('city'),
    district: idx('district'),
    state: idx('state'),
    country: idx('country'),
    zipcode: idx('zipcode'),
    accountType: idx('account_type'),
    accountSubType: idx('account_sub_type'),
    addressLine1: idx('address_line1'),
    addressLine2: idx('address_line2'),
    geoCoordinates: idx('geo_coordinates'),
  }

  const records: ProductCoverageRecord[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (r.length < headers.length || r.every((v) => v === '')) continue

    const rooftopId = (r[col.rooftopId] ?? '').trim()
    if (!rooftopId) continue

    const rawState = r[col.state] ?? ''
    const rawCountry = r[col.country] ?? ''
    const { code: stateCode, label: stateLabel } = normalizeState(rawState)
    const { normalized: countryNormalized, isUS } = normalizeCountry(rawCountry)
    const { lat, lng } = parseGeoCoordinates(r[col.geoCoordinates] ?? '')

    records.push({
      rooftopId,
      enterpriseId: (r[col.enterpriseId] ?? '').trim(),
      rooftopName: (r[col.rooftopName] ?? '').trim(),
      enterpriseName: (r[col.enterpriseName] ?? '').trim(),
      csmPoc: (r[col.csmPoc] ?? '').trim(),
      productStage: (r[col.productStage] ?? '').trim(),
      city: (r[col.city] ?? '').trim(),
      district: (r[col.district] ?? '').trim(),
      state: rawState.trim(),
      stateCode,
      stateLabel,
      country: rawCountry.trim(),
      countryNormalized,
      isUS,
      zipcode: (r[col.zipcode] ?? '').trim(),
      accountType: (r[col.accountType] ?? '').trim(),
      accountSubType: (r[col.accountSubType] ?? '').trim(),
      addressLine1: (r[col.addressLine1] ?? '').trim(),
      addressLine2: (r[col.addressLine2] ?? '').trim(),
      lat,
      lng,
    })
  }
  return records
}
