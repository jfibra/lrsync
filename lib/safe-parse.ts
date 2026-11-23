import { format } from "date-fns"

/**
 * Safely parses a JSON array (or already-parsed array/object/URL string) without ever throwing.
 */
export function safeParseArray<T = any>(raw: unknown): T[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter((item) => item !== null && item !== undefined) as T[]

  if (typeof raw === "string") {
    const trimmed = raw.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => item !== null && item !== undefined) as T[]
      }
      if (parsed && typeof parsed === "object") {
        return [parsed as T]
      }
      return []
    } catch {
      return []
    }
  }

  if (typeof raw === "object") {
    return [raw as T]
  }

  return []
}

/**
 * Safely parses JSON with a fallback value — never throws on plain text or malformed JSON.
 */
export function safeParseJson<T = any>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback
  if (typeof raw !== "string") return raw as T
  const trimmed = raw.trim()
  if (!trimmed) return fallback
  try {
    return JSON.parse(trimmed) as T
  } catch {
    return fallback
  }
}

/**
 * Safely formats a date string/Date with date-fns without throwing RangeError on invalid dates.
 */
export function safeFormatDate(
  raw: unknown,
  pattern = "MMM dd, yyyy",
  fallback = "-"
): string {
  if (!raw) return fallback
  try {
    const d = raw instanceof Date ? raw : new Date(String(raw))
    if (Number.isNaN(d.getTime())) return fallback
    return format(d, pattern)
  } catch {
    return fallback
  }
}

/**
 * Safely extracts the first/most recent remark text whether remarks is JSON array or plain text.
 */
export function safeExtractRemarkText(raw: unknown, fallback = "No remarks"): string {
  if (!raw) return fallback
  if (typeof raw === "string") {
    const trimmed = raw.trim()
    if (!trimmed) return fallback
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = parsed[0]
        if (typeof first === "string") return first || fallback
        return String(first?.remark || first?.text || fallback)
      }
      if (parsed && typeof parsed === "object") {
        return String((parsed as any).remark || (parsed as any).text || fallback)
      }
      return trimmed
    } catch {
      return trimmed
    }
  }
  return String(raw)
}
