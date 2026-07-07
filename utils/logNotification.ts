import { SupabaseClient } from "@supabase/supabase-js";

interface LogNotificationParams {
  action: string;
  description: string;
  user_email: string;
  user_name: string;
  user_uuid: string;
  ip_address?: string | null;
  location?: string | null;
  meta?: string | null;
  user_agent?: string | null;
}

export async function logNotification(
  supabase: SupabaseClient,
  params: LogNotificationParams
): Promise<{ error: any }> {
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

    const { error } = await supabase.rpc("log_notification", {
      ...params,
      ip_address: params.ip_address !== undefined ? params.ip_address : ip_address,
      location: params.location !== undefined ? params.location : location,
    });
    return { error };
  } catch (logError) {
    console.error("Error logging notification:", logError);
    return { error: logError };
  }
}
