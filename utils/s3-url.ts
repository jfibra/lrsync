/**
 * Formats and safely encodes any S3 URL so that special characters (like '#', spaces, etc.)
 * are properly escaped (%23, %20) before being requested by web browsers.
 */
export function formatS3Url(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const parts = trimmed.split("/");
      const protocol = parts[0];
      const host = parts[2];
      const pathSegments = parts
        .slice(3)
        .map((segment) => encodeURIComponent(decodeURIComponent(segment)));
      return `${protocol}//${host}/${pathSegments.join("/")}`;
    }
    return trimmed
      .split("/")
      .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
      .join("/");
  } catch {
    return trimmed;
  }
}

const OPTIMIZABLE_HOSTS = [
  ".amazonaws.com",
  ".supabase.co",
  ".cloudfront.net",
  "leuteriorealty.com",
];

/**
 * Returns a fast, edge-cached WebP/AVIF thumbnail URL via Next.js Image Optimization
 * for small grid/card previews without altering the original full-res file in S3.
 * Full-res `formatS3Url(url)` is still used for Zoom, Download, Print, and Crop.
 */
export function getThumbnailUrl(
  url: string | null | undefined,
  width: 256 | 384 | 640 = 640,
  quality = 75
): string {
  const formatted = formatS3Url(url);
  if (!formatted) return "";
  if (formatted.startsWith("blob:") || formatted.startsWith("data:")) return formatted;

  const cleanPath = formatted.split("?")[0].toLowerCase();
  if (cleanPath.endsWith(".pdf") || cleanPath.endsWith(".svg")) return formatted;

  try {
    const parsed = new URL(formatted);
    if (
      parsed.protocol === "https:" &&
      OPTIMIZABLE_HOSTS.some(
        (h) => parsed.hostname === h || parsed.hostname.endsWith(h)
      )
    ) {
      return `/_next/image?url=${encodeURIComponent(formatted)}&w=${width}&q=${quality}`;
    }
  } catch {
    // non-absolute URL
  }
  return formatted;
}
