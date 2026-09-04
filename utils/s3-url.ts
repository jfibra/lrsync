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
