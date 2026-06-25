-- ============================================================
-- Migration: Add receipt_pdf_path column + receipts storage bucket
-- Supports PDF attachments from Gmail (e.g., Rapido invoices)
-- ============================================================

-- 1. Add column to store the Supabase Storage path for receipt PDFs
alter table public.receipts
  add column if not exists receipt_pdf_path text;

-- 2. Create a private storage bucket for receipt PDFs
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- 3. RLS: owners can read their own receipt PDFs
create policy "receipts bucket: owner read" on storage.objects
  for select using (
    bucket_id = 'receipts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 4. RLS: users can only write to their own folder
create policy "receipts bucket: owner write" on storage.objects
  for insert with check (
    bucket_id = 'receipts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
