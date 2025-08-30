export async function logNotification(supabase, params) {
  try {
    // Fetch IP and location from your API route
    const res = await fetch("/api/get-ip-location");
    let ip_address = null;
    let location = "Unknown";
    if (res.ok) {
      const data = await res.json();
      ip_address = data.ip_address;
      location = data.location;
    }

    await supabase.rpc("log_notification", {
      ...params,
      ip_address,
      location,
    });
  } catch (logError) {
    console.error("Error logging notification:", logError);
  }
}