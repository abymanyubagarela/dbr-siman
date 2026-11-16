begin;

create table if not exists public.inventarisasi_foto_ruangan (
  id uuid primary key default gen_random_uuid(),
  inventarisasi_tahun_id uuid not null references public.inventarisasi_tahun(id) on delete cascade,
  master_ruangan_id uuid not null references public.master_ruangan(id) on delete restrict,
  image_path text not null,
  scanned_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists inventarisasi_foto_ruangan_year_idx
  on public.inventarisasi_foto_ruangan(inventarisasi_tahun_id);
create index if not exists inventarisasi_foto_ruangan_room_idx
  on public.inventarisasi_foto_ruangan(master_ruangan_id);

alter table public.inventarisasi_foto_ruangan enable row level security;
drop policy if exists inventory_room_photo_read on public.inventarisasi_foto_ruangan;
create policy inventory_room_photo_read on public.inventarisasi_foto_ruangan
  for select to authenticated
  using (public.is_inventory_staff());

revoke all on public.inventarisasi_foto_ruangan from public, anon, authenticated;
grant select on public.inventarisasi_foto_ruangan to authenticated;

create or replace function public.record_guest_room_photo(
  p_tahun_id uuid,
  p_ruangan_id uuid,
  p_image_path text,
  p_scanned_by text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_year_locked boolean;
  v_photo_id uuid;
  v_name text := nullif(pg_catalog.btrim(p_scanned_by), '');
  v_expected_prefix text := p_tahun_id::text || '/foto-saja/' || p_ruangan_id::text || '/';
begin
  if v_name is null then
    raise exception 'scanner name is required';
  end if;
  if p_image_path is null or pg_catalog.left(p_image_path, pg_catalog.length(v_expected_prefix)) <> v_expected_prefix then
    raise exception 'invalid photo path';
  end if;

  select y.is_locked
  into v_year_locked
  from public.inventarisasi_tahun as y
  where y.id = p_tahun_id
  for update;
  if not found or not v_year_locked then
    raise exception 'locked inventory year not found';
  end if;

  insert into public.inventarisasi_foto_ruangan (
    inventarisasi_tahun_id,
    master_ruangan_id,
    image_path,
    scanned_by
  ) values (
    p_tahun_id,
    p_ruangan_id,
    p_image_path,
    v_name
  ) returning id into v_photo_id;

  return v_photo_id;
end;
$function$;

revoke all on function public.record_guest_room_photo(uuid, uuid, text, text) from public;
grant execute on function public.record_guest_room_photo(uuid, uuid, text, text) to anon, authenticated;

commit;
