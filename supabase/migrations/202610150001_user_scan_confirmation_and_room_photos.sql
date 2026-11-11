drop function if exists public.record_guest_inventarisasi_scan(uuid, uuid, uuid, text, text);

create or replace function public.check_guest_inventarisasi_duplicate(p_tahun_id uuid, p_aset_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_tahun public.inventarisasi_tahun; v_room_name text;
begin
  select * into v_tahun from public.inventarisasi_tahun where id = p_tahun_id;
  if not found or not v_tahun.is_locked then raise exception 'locked inventory year not found'; end if;
  select r.nama_ruang into v_room_name
  from public.inventarisasi_aset ia
  join public.master_ruangan r on r.id = ia.master_ruangan_id
  where ia.inventarisasi_tahun_id = p_tahun_id and ia.master_aset_id = p_aset_id;
  if found then return jsonb_build_object('status', 'duplicate', 'room_name', v_room_name, 'year', v_tahun.tahun); end if;
  return jsonb_build_object('status', 'new', 'year', v_tahun.tahun);
end;
$$;

grant execute on function public.check_guest_inventarisasi_duplicate(uuid, uuid) to anon, authenticated;

create function public.record_guest_inventarisasi_scan(
  p_tahun_id uuid,
  p_aset_id uuid,
  p_ruangan_id uuid,
  p_image_path text,
  p_scanned_by text,
  p_allow_duplicate boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_tahun public.inventarisasi_tahun; v_aset public.inventarisasi_aset; v_name text := nullif(trim(p_scanned_by), ''); v_room_name text;
begin
  if v_name is null then raise exception 'scanner name is required'; end if;
  select * into v_tahun from public.inventarisasi_tahun where id = p_tahun_id for update;
  if not found or not v_tahun.is_locked then raise exception 'locked inventory year not found'; end if;
  if p_image_path is null or length(trim(p_image_path)) = 0 then raise exception 'photo is required'; end if;
  select r.nama_ruang into v_room_name
  from public.inventarisasi_aset ia
  join public.master_ruangan r on r.id = ia.master_ruangan_id
  where ia.inventarisasi_tahun_id = p_tahun_id and ia.master_aset_id = p_aset_id;
  if found and not p_allow_duplicate then return jsonb_build_object('status', 'duplicate', 'room_name', v_room_name, 'year', v_tahun.tahun); end if;
  insert into public.inventarisasi_aset(inventarisasi_tahun_id, master_aset_id, master_ruangan_id, jumlah_scan, last_scanned_at)
  values (p_tahun_id, p_aset_id, p_ruangan_id, 1, now())
  on conflict (inventarisasi_tahun_id, master_aset_id) do update set master_ruangan_id = excluded.master_ruangan_id, jumlah_scan = public.inventarisasi_aset.jumlah_scan + 1, last_scanned_at = now(), updated_at = now()
  returning * into v_aset;
  insert into public.inventarisasi_scan_log(inventarisasi_aset_id, master_ruangan_id, image_path, scanned_by)
  values (v_aset.id, p_ruangan_id, p_image_path, v_name);
  return jsonb_build_object('status', 'saved');
end;
$$;

grant execute on function public.record_guest_inventarisasi_scan(uuid, uuid, uuid, text, text, boolean) to anon, authenticated;

create table if not exists public.inventarisasi_foto_ruangan (
  id uuid primary key default gen_random_uuid(),
  inventarisasi_tahun_id uuid not null references public.inventarisasi_tahun(id) on delete cascade,
  master_ruangan_id uuid not null references public.master_ruangan(id) on delete restrict,
  image_path text not null,
  scanned_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists inventarisasi_foto_ruangan_year_idx on public.inventarisasi_foto_ruangan(inventarisasi_tahun_id);
create index if not exists inventarisasi_foto_ruangan_room_idx on public.inventarisasi_foto_ruangan(master_ruangan_id);
alter table public.inventarisasi_foto_ruangan enable row level security;
create policy inventory_room_photo_read on public.inventarisasi_foto_ruangan for select to authenticated using (public.is_inventory_staff());

create or replace function public.record_guest_room_photo(
  p_tahun_id uuid,
  p_ruangan_id uuid,
  p_image_path text,
  p_scanned_by text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_tahun public.inventarisasi_tahun; v_id uuid; v_name text := nullif(trim(p_scanned_by), '');
begin
  if v_name is null then raise exception 'scanner name is required'; end if;
  select * into v_tahun from public.inventarisasi_tahun where id = p_tahun_id for update;
  if not found or not v_tahun.is_locked then raise exception 'locked inventory year not found'; end if;
  if p_image_path is null or length(trim(p_image_path)) = 0 then raise exception 'photo is required'; end if;
  insert into public.inventarisasi_foto_ruangan(inventarisasi_tahun_id, master_ruangan_id, image_path, scanned_by)
  values (p_tahun_id, p_ruangan_id, p_image_path, v_name) returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.record_guest_room_photo(uuid, uuid, text, text) to anon, authenticated;
