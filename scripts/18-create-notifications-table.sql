-- Create notifications table
create table public.notifications (
  id bigserial not null,
  user_uuid uuid null,
  user_name text null,
  user_email text null,
  action text not null,
  description text null,
  ip_address text null,
  location jsonb null,
  user_agent text null,
  meta jsonb null,
  created_at timestamp with time zone null default now(),
  constraint notifications_pkey primary key (id)
) TABLESPACE pg_default;

-- Create indexes
create index IF not exists idx_notifications_user_uuid on public.notifications using btree (user_uuid) TABLESPACE pg_default;
create index IF not exists idx_notifications_action on public.notifications using btree (action) TABLESPACE pg_default;
create index IF not exists idx_notifications_created_at on public.notifications using btree (created_at desc) TABLESPACE pg_default;
create index IF not exists idx_notifications_user_action on public.notifications using btree (user_uuid, action) TABLESPACE pg_default;
