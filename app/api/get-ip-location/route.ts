export async function GET(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    (request as any).ip ||
    null;

  // Use a public IP geolocation API
  const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
  const geo = await geoRes.json();

  return Response.json({
    ip_address: ip,
    location:
      geo.city && geo.country_name
        ? `${geo.city}, ${geo.country_name}`
        : geo.country_name || "Unknown",
  });
}