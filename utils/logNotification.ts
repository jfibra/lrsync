export async function logNotification(supabase, params) {
  try {
    // Fetch IP and location from your API route
    const res = await fetch("/api/get-ip-location");
    const { ip_address, location } = await res.json();

    await logNotification(supabase, { 
      ...params,
      ip_address,
      location,
    });
  } catch (logError) {
    console.error("Error logging notification:", logError);
  }
}
