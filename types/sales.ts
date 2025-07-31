export interface Sales {
  id: string
  tax_month: string
  tin_id: string | null
  tin: string
  name: string
  type: string
  substreet_street_brgy: string | null
  district_city_zip: string | null
  gross_taxable: number
  total_actual_amount: number
  sale_type: string
  invoice_number: string | null
  tax_type: string
  pickup_date: string | null
  cheque: string[] | null
  voucher: string[] | null
  doc_2307: string[] | null
  invoice: string[] | null
  deposit_slip: string[] | null
  date_added: string
  user_uuid: string | null
  user_full_name: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
}

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
  remarks?: string | null;
// ...existing code...
  created_by?: string
  is_deleted?: boolean
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
