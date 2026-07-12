-- Store the resume file so past scans can be re-analyzed against new job
-- descriptions from the profile/dashboard.

-- Track where the PDF lives + its original name on each scan.
alter table public.scans
  add column if not exists storage_path text,
  add column if not exists file_name text;

-- Private bucket for uploaded resumes. Files are namespaced per user:
--   resumes/<user_id>/<file_hash>.pdf
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

-- RLS: a user may only touch objects inside their own folder.
create policy "resumes: read own"
  on storage.objects for select
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "resumes: insert own"
  on storage.objects for insert
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "resumes: delete own"
  on storage.objects for delete
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
