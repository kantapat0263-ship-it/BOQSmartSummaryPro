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


-- ====== คลังราคากลางของบริษัท (material_prices) ======
-- รวมราคาวัสดุจากทุก BOQ ของทุกคน -> อ่านได้ทุกคน (company-wide), เพิ่ม/ลบได้เฉพาะของตัวเอง
create table if not exists public.material_prices (
  id           text primary key,
  source_id    text,            -- โครงการต้นทางของราคา (= project id)
  mkey         text not null,   -- คีย์จับคู่วัสดุ (ชื่อ+หน่วย normalize)
  name         text,
  unit         text,
  unit_rate    double precision,
  project_name text,
  user_id      uuid not null references auth.users (id) on delete cascade,
  recorded_at  timestamptz not null default now()
);

create index if not exists material_prices_mkey_idx on public.material_prices (mkey);
create index if not exists material_prices_source_idx on public.material_prices (source_id);

alter table public.material_prices enable row level security;

-- อ่านได้ทุกคนที่ล็อกอิน (คลังกลางบริษัท)
drop policy if exists mp_select_all on public.material_prices;
create policy mp_select_all on public.material_prices
  for select to authenticated using (true);

-- เพิ่ม/ลบได้เฉพาะแถวของตัวเอง
drop policy if exists mp_insert_own on public.material_prices;
create policy mp_insert_own on public.material_prices
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists mp_delete_own on public.material_prices;
create policy mp_delete_own on public.material_prices
  for delete to authenticated using (auth.uid() = user_id);


-- ====== คุมต้นทุน (cost_control) — 1 ก้อนต่อ 1 โครงการ ======
-- เก็บ กำไรเป้า / ความคืบหน้า / รายจ่ายจริง เป็น jsonb ก้อนเดียว
create table if not exists public.cost_control (
  project_id text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists cost_control_user_idx on public.cost_control (user_id);

alter table public.cost_control enable row level security;

drop policy if exists cc_select_own on public.cost_control;
create policy cc_select_own on public.cost_control
  for select using (auth.uid() = user_id);

drop policy if exists cc_insert_own on public.cost_control;
create policy cc_insert_own on public.cost_control
  for insert with check (auth.uid() = user_id);

drop policy if exists cc_update_own on public.cost_control;
create policy cc_update_own on public.cost_control
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists cc_delete_own on public.cost_control;
create policy cc_delete_own on public.cost_control
  for delete using (auth.uid() = user_id);
