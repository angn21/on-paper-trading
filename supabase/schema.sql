-- Run in Supabase SQL Editor (Dashboard → SQL → New query)

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  username_lower text not null unique,
  pin_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists portfolios (
  user_id uuid primary key references profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists portfolios_updated_at_idx on portfolios(updated_at);

-- Optional: block direct client access (API uses service role only)
alter table profiles enable row level security;
alter table portfolios enable row level security;
