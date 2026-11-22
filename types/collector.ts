export type CollectorWorkflowStatus =
  | "invoice_issued"
  | "cheque_collected"
  | "deposited"
  | "verified"
  | "returned"
  | "converted_to_sale"

export type ChequeStatus = "pending" | "deposited" | "verified"

export interface CollectorTransaction {
  id: string
  workflow_status: CollectorWorkflowStatus
  cheque_status: ChequeStatus
  assigned_area: string | null

  // Developer (from taxpayer_listings where type = 'sales')
  developer_tin_id: string | null
  developer_tin: string | null
  developer_name: string | null
  developer_substreet_street_brgy: string | null
  developer_district_city_zip: string | null

  // Step 1: Invoice Issued
  invoice_photo_urls: string[]
  invoice_date: string
  commission_amount: number | null
  invoice_remarks: string | null
  invoice_ocr_data: Record<string, any> | null
  invoice_clarity_score: number | null
  invoice_collected_by_uuid: string | null
  invoice_collected_by_name: string | null
  invoice_date_collected: string | null
  invoice_time_collected: string | null
  invoice_captured_at: string
  invoice_location: string | null
  invoice_latitude: number | null
  invoice_longitude: number | null
  invoice_gps_accuracy: number | null
  invoice_device_used: string | null

  // Step 2: Cheque Collection
  cheque_photo_urls: string[]
  doc_2307_photo_urls: string[]
  voucher_photo_urls: string[]
  cheque_number: string | null
  cheque_bank: string | null
  cheque_branch: string | null
  cheque_date: string | null
  cheque_amount: number | null
  amount_discrepancy: boolean
  received_from_name: string | null
  cheque_remarks: string | null
  cheque_ocr_data: Record<string, any> | null
  cheque_clarity_score: number | null
  cheque_collected_by_uuid: string | null
  cheque_collected_by_name: string | null
  cheque_date_collected: string | null
  cheque_time_collected: string | null
  cheque_captured_at: string | null
  cheque_location: string | null
  cheque_latitude: number | null
  cheque_longitude: number | null
  cheque_gps_accuracy: number | null
  cheque_device_used: string | null

  // Step 3: Deposit
  deposit_slip_urls: string[]
  deposit_bank: string | null
  deposit_reference_no: string | null
  deposit_amount: number | null
  deposit_date: string | null
  deposit_time: string | null
  deposited_at: string | null
  deposited_by_uuid: string | null
  deposited_by_name: string | null
  deposit_location: string | null
  deposit_latitude: number | null
  deposit_longitude: number | null
  deposit_gps_accuracy: number | null
  deposit_device_used: string | null
  deposit_remarks: string | null
  deposit_ocr_data: Record<string, any> | null
  deposit_clarity_score: number | null
  notified_accounting_at: string | null

  // Step 4: Accounting Validation & Sales Link
  verified_by_uuid: string | null
  verified_by_name: string | null
  verified_at: string | null
  accounting_remarks: string | null
  sales_id: string | null
  converted_to_sale_at: string | null

  is_deleted: boolean
  created_at: string
  updated_at: string
}
