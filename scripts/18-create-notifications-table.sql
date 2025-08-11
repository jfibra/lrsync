-- Create notifications table for activity tracking
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

-- Create indexes for better performance
create index IF not exists idx_notifications_user_uuid on public.notifications using btree (user_uuid) TABLESPACE pg_default;
create index IF not exists idx_notifications_action on public.notifications using btree (action) TABLESPACE pg_default;
create index IF not exists idx_notifications_created_at on public.notifications using btree (created_at desc) TABLESPACE pg_default;
create index IF not exists idx_notifications_user_action on public.notifications using btree (user_uuid, action) TABLESPACE pg_default;

-- Add foreign key relationship to user_profiles
alter table public.notifications 
add constraint fk_notifications_user_profiles 
foreign key (user_uuid) references public.user_profiles(auth_user_id);

-- Enable RLS
alter table public.notifications enable row level security;

-- Create RLS policies
create policy "Super admins can view all notifications" on public.notifications
  for select using (
    exists (
      select 1 from public.user_profiles
      where auth_user_id = auth.uid()
      and role = 'super_admin'
    )
  );

create policy "Admins can view notifications in their area" on public.notifications
  for select using (
    exists (
      select 1 from public.user_profiles up
      where up.auth_user_id = auth.uid()
      and up.role = 'admin'
      and (
        up.assigned_area is null 
        or exists (
          select 1 from public.user_profiles target_up
          where target_up.auth_user_id = notifications.user_uuid
          and target_up.assigned_area = up.assigned_area
        )
      )
    )
  );

-- Allow system to insert notifications
create policy "System can insert notifications" on public.notifications
  for insert with check (true);
