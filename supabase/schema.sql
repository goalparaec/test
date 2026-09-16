-- Run this once in Supabase SQL Editor.
-- The actual Excel files are stored in Supabase Storage.
-- This table stores metadata and the Storage path.

create table if not exists public.report_downloads (
  id uuid primary key default gen_random_uuid(),
  report_name text not null default 'Daily Performance Report',
  report_date date not null,
  file_name text not null,
  storage_path text not null unique,
  status text not null default 'downloaded'
    check (status in ('downloaded', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists report_downloads_date_idx
  on public.report_downloads(report_date desc);

-- The app uses the Supabase SERVICE ROLE key only on the server.
-- Therefore this table does not need client-side INSERT/UPDATE policies
-- for this first version.
