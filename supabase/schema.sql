-- PAC Cost Control — Supabase schema
-- รันใน Supabase: Dashboard -> SQL Editor -> วางทั้งหมดนี้ -> Run

create table if not exists public.projects (
  id         text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  file_name  text,
  file_size  bigint,
  grand      double precision,
  result     jsonb,
  saved_at   timestamptz not null default now()
);

create index if not exists projects_user_idx on public.projects (user_id, saved_at desc);

-- เปิด Row Level Security: ผู้ใช้เห็น/แก้ได้เฉพาะโครงการของตัวเอง
alter table public.projects enable row level security;

drop policy if exists projects_select_own on public.projects;
create policy projects_select_own on public.projects
  for select using (auth.uid() = user_id);

drop policy if exists projects_insert_own on public.projects;
create policy projects_insert_own on public.projects
  for insert with check (auth.uid() = user_id);

drop policy if exists projects_update_own on public.projects;
create policy projects_update_own on public.projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists projects_delete_own on public.projects;
create policy projects_delete_own on public.projects
  for delete using (auth.uid() = user_id);

-- หมายเหตุ: "แชร์ทั้งทีม" ทำเพิ่มได้ภายหลัง (เพิ่มตาราง teams + แก้ policy ให้ดูตามทีม)
