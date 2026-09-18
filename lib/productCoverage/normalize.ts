// Normalization helpers for the Product / Account Coverage second dataset.
// Kept fully separate from lib/aggregation (the existing TAM dataset's
// normalization) so nothing here can affect existing TAM calculations.

import { US_STATE_CODE_TO_NAME, US_STATE_NAME_TO_CODE, US_STATE_CODES } from './usStates'

const US_COUNTRY_VARIANTS = new Set([
  'united states',
  'united states of america',
  'usa',
  'us',
  'u.s.a',
  'u.s.a.',
  'u.s.',
  'america',
  'americas',
])

export function normalizeCountry(raw: string | undefined | null): { normalized: string; isUS: boolean } {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return { normalized: '', isUS: false }
  const key = trimmed.toLowerCase()
  if (US_COUNTRY_VARIANTS.has(key)) return { normalized: 'United States', isUS: true }
  return { normalized: trimmed, isUS: false }
}

/**
 * Resolves a raw state value (full name, USPS code, or "Name (XX)") to a
 * { code, label } pair. Returns empty strings when it isn't a recognized US
 * state — callers keep the raw value for display in that case.
 */
export function normalizeState(raw: string | undefined | null): { code: string; label: string } {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return { code: '', label: '' }

  // "Massachusetts (MA)" / "Georgia (GA)" style values.
  const parenMatch = trimmed.match(/^(.*)\(([A-Za-z]{2})\)\s*$/)
  if (parenMatch) {
    const code = parenMatch[2].toUpperCase()
    if (US_STATE_CODES.has(code)) return { code, label: US_STATE_CODE_TO_NAME[code] }
  }

  const upper = trimmed.toUpperCase()
  if (upper.length === 2 && US_STATE_CODES.has(upper)) {
    return { code: upper, label: US_STATE_CODE_TO_NAME[upper] }
  }

  const lower = trimmed.toLowerCase()
  const code = US_STATE_NAME_TO_CODE[lower]
  if (code) return { code, label: US_STATE_CODE_TO_NAME[code] }

  return { code: '', label: trimmed }
}
