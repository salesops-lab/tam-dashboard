import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { parseProductCoverageCsv } from '@/lib/productCoverage/parseCsv'
import type { ProductCoverageResponse } from '@/types/productCoverage'

// Isolated data source for the "Product / Account Coverage" section.
// Completely separate from /api/data (the existing TAM dataset) — never
// merges with it and is never written to Vercel Blob.
//
// PRODUCT_COVERAGE_SHEET_CSV_URL must point at a published Google Sheet CSV
// export (File > Share > Publish to web > CSV) — this dataset contains
// dealer/CSM account data and is never bundled into the repo. For local
// development only, you may also drop a CSV with the same columns at
// data/product-coverage.csv (gitignored, never committed) as a fallback
// when the env var is unset.

export async function GET() {
  try {
    const sheetUrl = process.env.PRODUCT_COVERAGE_SHEET_CSV_URL

    let csvText: string
    if (sheetUrl) {
      const response = await fetch(sheetUrl, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`Failed to fetch product coverage sheet: ${response.status}`)
      }
      csvText = await response.text()
    } else {
      const filePath = path.join(process.cwd(), 'data', 'product-coverage.csv')
      try {
        csvText = await readFile(filePath, 'utf8')
      } catch {
        return NextResponse.json(
          {
            error:
              'No product coverage data source configured. Set PRODUCT_COVERAGE_SHEET_CSV_URL, or place a local CSV at data/product-coverage.csv for development.',
          },
          { status: 503 }
        )
      }
    }

    const records = parseProductCoverageCsv(csvText)
    const body: ProductCoverageResponse = { records, fetchedAt: new Date().toISOString() }

    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Error loading product coverage data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
