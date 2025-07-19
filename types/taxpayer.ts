export type TaxpayerStatus = "active" | "inactive" | "deleted"
export type TaxpayerType = "sales" | "purchases"

export interface TaxpayerListing {
  id: string
  tin: string
  registered_name: string | null
  substreet_street_brgy: string | null
  district_city_zip: string | null
  type: TaxpayerType
  date_added: string
  user_uuid: string | null
  user_full_name: string | null
  created_at: string
  updated_at: string
  user_profiles?: {
    assigned_area: string | null
  } | null
}

export interface TaxpayerFormData {
  tin: string
  registered_name: string
  substreet_street_brgy: string
  district_city_zip: string
  type: TaxpayerType
}
