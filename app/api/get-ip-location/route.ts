import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket?.remoteAddress ||
    null;

  // Use a public IP geolocation API
  const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
  const geo = await geoRes.json();

  res.status(200).json({
    ip_address: ip,
    location:
      geo.city && geo.country_name
        ? `${geo.city}, ${geo.country_name}`
        : geo.country_name || "Unknown",
  });
}
