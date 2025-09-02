-- Create purchases_categories table for managing purchase categories
create table public.purchases_categories (
  id uuid not null default gen_random_uuid (),
  category text not null,
  is_default boolean null default false,
  is_deleted boolean null default false,
  deleted_at timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  user_uuid uuid null,
  user_full_name character varying(150) null,
  user_area character varying(150) null,
  constraint purchases_categories_pkey primary key (id),
  constraint purchases_categories_user_uuid_fkey foreign KEY (user_uuid) references auth.users (id)
) TABLESPACE pg_default;

-- Create indexes for better performance
create index IF not exists idx_purchases_categories_user_uuid on public.purchases_categories using btree (user_uuid) TABLESPACE pg_default;

create index IF not exists idx_purchases_categories_user_full_name on public.purchases_categories using btree (user_full_name) TABLESPACE pg_default;

create index IF not exists idx_purchases_categories_user_area on public.purchases_categories using btree (user_area) TABLESPACE pg_default;

-- Insert some default categories
INSERT INTO public.purchases_categories (category, is_default, user_full_name, user_area) VALUES
('Office Supplies', true, 'System', 'Default'),
('Equipment', true, 'System', 'Default'),
('Software', true, 'System', 'Default'),
('Services', true, 'System', 'Default'),
('Maintenance', true, 'System', 'Default');
