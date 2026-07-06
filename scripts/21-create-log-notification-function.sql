-- Create log_notification RPC function
CREATE OR REPLACE FUNCTION public.log_notification(
  action text,
  description text,
  ip_address text,
  location text,
  meta text,
  user_agent text,
  user_email text,
  user_name text,
  user_uuid uuid
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.notifications (
    action,
    description,
    ip_address,
    location,
    meta,
    user_agent,
    user_email,
    user_name,
    user_uuid
  ) VALUES (
    action,
    description,
    ip_address,
    location,
    meta::jsonb,
    user_agent,
    user_email,
    user_name,
    user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
