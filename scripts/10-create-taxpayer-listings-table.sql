-- Create taxpayer_listings table with simplified structure
create table taxpayer_listings (
  id uuid primary key default gen_random_uuid(),
  tin varchar(20) not null,
  registered_name varchar(255),
  substreet_street_brgy text,
  district_city_zip text,
  type varchar(20) not null check (type in ('sales', 'purchases')),
  date_added date default current_date,
  user_uuid uuid references auth.users(id),
  user_full_name varchar(150),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create indexes for better performance
create index idx_taxpayer_listings_tin on taxpayer_listings(tin);
create index idx_taxpayer_listings_type on taxpayer_listings(type);
create index idx_taxpayer_listings_user_uuid on taxpayer_listings(user_uuid);
create index idx_taxpayer_listings_created_at on taxpayer_listings(created_at);

-- Enable RLS
alter table taxpayer_listings enable row level security;

-- Create policies
create policy "Users can view all taxpayer listings" on taxpayer_listings
  for select using (true);

create policy "Users can insert taxpayer listings" on taxpayer_listings
  for insert with check (true);

create policy "Users can update taxpayer listings" on taxpayer_listings
  for update using (true);

create policy "Users can delete taxpayer listings" on taxpayer_listings
  for delete using (true);
