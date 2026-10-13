create table if not exists public.inventarisasi_tahun (
  id uuid primary key default gen_random_uuid(),
  tahun integer not null unique check (tahun between 2000 and 2200),
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  locked_at timestamptz
);

create table if not exists public.inventarisasi_aset (
  id uuid primary key default gen_random_uuid(),
  inventarisasi_tahun_id uuid not null references public.inventarisasi_tahun(id) on delete cascade,
  master_aset_id uuid not null references public.master_aset(id) on delete restrict,
  master_ruangan_id uuid not null references public.master_ruangan(id) on delete restrict,
  jumlah_scan integer not null default 1 check (jumlah_scan > 0),
  last_scanned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (inventarisasi_tahun_id, master_aset_id)
);

create table if not exists public.inventarisasi_scan_log (
  id uuid primary key default gen_random_uuid(),
  inventarisasi_aset_id uuid not null references public.inventarisasi_aset(id) on delete restrict,
  master_ruangan_id uuid not null references public.master_ruangan(id) on delete restrict,
  image_path text not null,
  scanned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists inventarisasi_aset_tahun_idx on public.inventarisasi_aset(inventarisasi_tahun_id);
create index if not exists inventarisasi_aset_ruang_idx on public.inventarisasi_aset(master_ruangan_id);
create index if not exists inventarisasi_scan_log_aset_idx on public.inventarisasi_scan_log(inventarisasi_aset_id);
create index if not exists inventarisasi_scan_log_scanned_idx on public.inventarisasi_scan_log(scanned_at desc);

create or replace function public.set_inventarisasi_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_inventarisasi_aset_updated_at on public.inventarisasi_aset;
create trigger trg_inventarisasi_aset_updated_at before update on public.inventarisasi_aset for each row execute function public.set_inventarisasi_updated_at();

create or replace function public.is_inventory_staff() returns boolean language sql stable security invoker set search_path = public as $$ select coalesce((auth.jwt()->'app_metadata'->>'inventory_role') in ('staff','admin'), false) $$;
create or replace function public.is_inventory_admin() returns boolean language sql stable security invoker set search_path = public as $$ select coalesce(auth.jwt()->'app_metadata'->>'inventory_role' = 'admin', false) $$;

create or replace function public.record_inventarisasi_scan(p_tahun_id uuid, p_aset_id uuid, p_ruangan_id uuid, p_image_path text)
returns public.inventarisasi_aset language plpgsql security invoker set search_path = public as $$
declare v_tahun public.inventarisasi_tahun; v_aset public.inventarisasi_aset;
begin
  if not public.is_inventory_staff() then raise exception 'not authorized'; end if;
  select * into v_tahun from public.inventarisasi_tahun where id = p_tahun_id for update;
  if not found then raise exception 'inventory year not found'; end if;
  if v_tahun.is_locked then raise exception 'inventory year is locked'; end if;
  if p_image_path is null or length(trim(p_image_path)) = 0 then raise exception 'photo is required'; end if;
  insert into public.inventarisasi_aset(inventarisasi_tahun_id, master_aset_id, master_ruangan_id, jumlah_scan, last_scanned_at)
  values (p_tahun_id, p_aset_id, p_ruangan_id, 1, now())
  on conflict (inventarisasi_tahun_id, master_aset_id) do update set master_ruangan_id = excluded.master_ruangan_id, jumlah_scan = public.inventarisasi_aset.jumlah_scan + 1, last_scanned_at = now(), updated_at = now()
  returning * into v_aset;
  insert into public.inventarisasi_scan_log(inventarisasi_aset_id, master_ruangan_id, image_path) values (v_aset.id, p_ruangan_id, p_image_path);
  return v_aset;
end $$;

create or replace function public.lock_inventarisasi_tahun(p_tahun_id uuid) returns void language plpgsql security invoker set search_path = public as $$ begin if not public.is_inventory_admin() then raise exception 'not authorized'; end if; update public.inventarisasi_tahun set is_locked = true, locked_at = coalesce(locked_at, now()) where id = p_tahun_id; end $$;

alter table public.inventarisasi_tahun enable row level security;
alter table public.inventarisasi_aset enable row level security;
alter table public.inventarisasi_scan_log enable row level security;
drop policy if exists inventory_year_read on public.inventarisasi_tahun;
drop policy if exists inventory_year_admin_write on public.inventarisasi_tahun;
drop policy if exists inventory_asset_read on public.inventarisasi_aset;
drop policy if exists inventory_log_read on public.inventarisasi_scan_log;
create policy inventory_year_read on public.inventarisasi_tahun for select to authenticated using (public.is_inventory_staff());
create policy inventory_year_admin_write on public.inventarisasi_tahun for all to authenticated using (public.is_inventory_admin()) with check (public.is_inventory_admin());
create policy inventory_asset_read on public.inventarisasi_aset for select to authenticated using (public.is_inventory_staff());
create policy inventory_log_read on public.inventarisasi_scan_log for select to authenticated using (public.is_inventory_staff());

insert into storage.buckets (id, name, public) values ('inventarisasi-foto', 'inventarisasi-foto', false) on conflict (id) do nothing;
drop policy if exists inventory_photo_staff on storage.objects;
create policy inventory_photo_staff on storage.objects for all to authenticated using (bucket_id = 'inventarisasi-foto' and public.is_inventory_staff()) with check (bucket_id = 'inventarisasi-foto' and public.is_inventory_staff());
revoke insert, update, delete on public.inventarisasi_aset from authenticated;
revoke insert, update, delete on public.inventarisasi_scan_log from authenticated;
grant execute on function public.record_inventarisasi_scan(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.lock_inventarisasi_tahun(uuid) to authenticated;
