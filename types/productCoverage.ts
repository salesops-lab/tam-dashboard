// Types for the isolated "Product / Account Coverage" section.
// This dataset is intentionally separate from the existing TAM dataset
// (types/dashboard.ts) and must never be merged with it.

export const PRODUCT_STAGES = [
  'Studio Live',
  'Studio Churned',
  'Studio Sales Drop',
  'Vini Sales Drop',
  'Vini Live',
  'Vini Onboarding',
  'Vini Future Churn',
  'Studio Future Churn',
  'Studio Onboarding',
  'Vini Churned',
] as const

export type ProductStage = (typeof PRODUCT_STAGES)[number]

export interface ProductCoverageRecord {
  rooftopId: string
  enterpriseId: string
  rooftopName: string
  enterpriseName: string
  csmPoc: string
  productStage: string
  city: string
  district: string
  state: string
  /** Normalized 2-letter USPS code, or '' when the state couldn't be resolved. */
  stateCode: string
  /** Normalized full state name, or the raw value when the state couldn't be resolved. */
  stateLabel: string
  country: string
  /** Normalized country name (e.g. "United States"), or the trimmed raw value. */
  countryNormalized: string
  isUS: boolean
  zipcode: string
  accountType: string
  accountSubType: string
  addressLine1: string
  addressLine2: string
  lat: number | null
  lng: number | null
}

export interface ProductCoverageResponse {
  records: ProductCoverageRecord[]
  fetchedAt: string
}
