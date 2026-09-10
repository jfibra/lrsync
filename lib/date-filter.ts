export interface MonthOption {
  value: string
  label: string
  short: string
}

export const MONTHS_LIST: MonthOption[] = [
  { value: "01", label: "January", short: "Jan" },
  { value: "02", label: "February", short: "Feb" },
  { value: "03", label: "March", short: "Mar" },
  { value: "04", label: "April", short: "Apr" },
  { value: "05", label: "May", short: "May" },
  { value: "06", label: "June", short: "Jun" },
  { value: "07", label: "July", short: "Jul" },
  { value: "08", label: "August", short: "Aug" },
  { value: "09", label: "September", short: "Sep" },
  { value: "10", label: "October", short: "Oct" },
  { value: "11", label: "November", short: "Nov" },
  { value: "12", label: "December", short: "Dec" },
]

export const QUARTER_PRESETS: Record<string, { label: string; months: string[] }> = {
  Q1: { label: "Q1 (Jan-Mar)", months: ["01", "02", "03"] },
  Q2: { label: "Q2 (Apr-Jun)", months: ["04", "05", "06"] },
  Q3: { label: "Q3 (Jul-Sep)", months: ["07", "08", "09"] },
  Q4: { label: "Q4 (Oct-Dec)", months: ["10", "11", "12"] },
}

export function getAvailableYears(): string[] {
  const currentYear = new Date().getFullYear()
  const maxYear = Math.max(currentYear, 2026)
  const minYear = 2023
  const years: string[] = []
  for (let y = maxYear; y >= minYear; y--) {
    years.push(String(y))
  }
  return years
}

export interface TaxMonthFilterResult {
  type: "none" | "range" | "or"
  startDate?: string
  endDate?: string
  orClause?: string
}

export function buildTaxMonthFilter(
  year: string,
  months: string[],
  availableYears: string[] = getAvailableYears(),
): TaxMonthFilterResult {
  const isAllYears = !year || year === "all"
  const hasSpecificMonths = Array.isArray(months) && months.length > 0 && months.length < 12

  // 1. All time (no date filter)
  if (isAllYears && !hasSpecificMonths) {
    return { type: "none" }
  }

  // 2. Specific Year, Full Year (all 12 months or no months specified)
  if (!isAllYears && !hasSpecificMonths) {
    const y = Number(year)
    return {
      type: "range",
      startDate: `${y}-01-01`,
      endDate: `${y + 1}-01-01`,
    }
  }

  // 3. Specific Year, Single Month
  if (!isAllYears && months.length === 1) {
    const y = Number(year)
    const m = Number(months[0])
    const nextM = m === 12 ? 1 : m + 1
    const nextY = m === 12 ? y + 1 : y
    return {
      type: "range",
      startDate: `${y}-${months[0]}-01`,
      endDate: `${nextY}-${String(nextM).padStart(2, "0")}-01`,
    }
  }

  // 4. Multiple months (or specific months across all years)
  const yearsToQuery = isAllYears ? availableYears : [year]
  const monthsToQuery = [...months].sort()
  const clauses: string[] = []

  for (const yStr of yearsToQuery) {
    const y = Number(yStr)
    for (const mStr of monthsToQuery) {
      const m = Number(mStr)
      const nextM = m === 12 ? 1 : m + 1
      const nextY = m === 12 ? y + 1 : y
      clauses.push(`and(tax_month.gte.${yStr}-${mStr}-01,tax_month.lt.${nextY}-${String(nextM).padStart(2, "0")}-01)`)
    }
  }

  return {
    type: "or",
    orClause: clauses.join(","),
  }
}

export function applyTaxMonthFilter<T>(
  query: T,
  year: string,
  months: string[],
  availableYears?: string[],
): T {
  const filter = buildTaxMonthFilter(year, months, availableYears)
  const q = query as any
  if (filter.type === "range" && filter.startDate && filter.endDate) {
    return q.gte("tax_month", filter.startDate).lt("tax_month", filter.endDate)
  }
  if (filter.type === "or" && filter.orClause) {
    return q.or(filter.orClause)
  }
  return q
}

export function formatDatePeriodLabel(year: string, months: string[]): string {
  const isAllYears = !year || year === "all"
  const hasSpecificMonths = Array.isArray(months) && months.length > 0 && months.length < 12

  if (isAllYears && !hasSpecificMonths) {
    return "All Time"
  }

  const sortedMonths = [...(months || [])].sort()
  const monthMap = new Map(MONTHS_LIST.map((m) => [m.value, m.short]))
  const fullMonthMap = new Map(MONTHS_LIST.map((m) => [m.value, m.label]))

  if (!isAllYears && !hasSpecificMonths) {
    return `Year ${year}`
  }

  // Check for Quarter match
  const joined = sortedMonths.join(",")
  let quarterName = ""
  if (joined === "01,02,03") quarterName = "Q1"
  else if (joined === "04,05,06") quarterName = "Q2"
  else if (joined === "07,08,09") quarterName = "Q3"
  else if (joined === "10,11,12") quarterName = "Q4"

  const yearSuffix = isAllYears ? "" : ` ${year}`

  if (quarterName) {
    return `${quarterName}${yearSuffix} (${sortedMonths.map((m) => monthMap.get(m)).join("-")})`
  }

  if (sortedMonths.length === 1) {
    return `${fullMonthMap.get(sortedMonths[0])}${yearSuffix}`
  }

  return `${sortedMonths.map((m) => monthMap.get(m)).join(", ")}${yearSuffix}`
}
