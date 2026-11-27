-- Create MCP API Keys table for Read-Only and Admin Full Access MCP clients
CREATE TABLE IF NOT EXISTS public.mcp_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  access_level text NOT NULL CHECK (access_level IN ('read_only', 'admin_full')),
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_by_uuid uuid,
  created_by_name text,
  created_by_email text,
  last_used_at timestamptz,
  request_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_hash ON public.mcp_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_active ON public.mcp_api_keys(is_active);

ALTER TABLE public.mcp_api_keys ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mcp_api_keys'
      AND policyname = 'Allow authenticated users to manage mcp_api_keys'
  ) THEN
    CREATE POLICY "Allow authenticated users to manage mcp_api_keys"
      ON public.mcp_api_keys
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

GRANT ALL ON TABLE public.mcp_api_keys TO postgres, anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
