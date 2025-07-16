export interface SalesRecord {
  id: string
  tin_number: string
  company_name: string
  barangay: string
  city: string
  total_sales: number
  tax_type: "VAT" | "Non-VAT"
  sales_month: string
  created_at: string
  updated_at: string
  created_by?: string
}

export interface SalesStats {
  totalGrossTaxable: number
  totalRecords: number
  vatRecords: number
  nonVatRecords: number
}

export interface MonthOption {
  value: string
  label: string
  date: Date
}
