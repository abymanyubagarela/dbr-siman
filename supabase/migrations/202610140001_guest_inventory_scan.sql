alter table public.inventarisasi_scan_log add column if not exists scanned_by text not null default 'Guest';

create or replace function public.record_guest_inventarisasi_scan(
  p_tahun_id uuid,
  p_aset_id uuid,
  p_ruangan_id uuid,
  p_image_path text,
  p_scanned_by text
) returns public.inventarisasi_aset
language plpgsql security definer set search_path = public
as $$
declare v_tahun public.inventarisasi_tahun; v_aset public.inventarisasi_aset; v_name text := nullif(trim(p_scanned_by), '');
begin
  if v_name is null then raise exception 'scanner name is required'; end if;
  select * into v_tahun from public.inventarisasi_tahun where id = p_tahun_id for update;
  if not found or not v_tahun.is_locked then raise exception 'locked inventory year not found'; end if;
  if p_image_path is null or length(trim(p_image_path)) = 0 then raise exception 'photo is required'; end if;
  insert into public.inventarisasi_aset(inventarisasi_tahun_id, master_aset_id, master_ruangan_id, jumlah_scan, last_scanned_at)
  values (p_tahun_id, p_aset_id, p_ruangan_id, 1, now())
  on conflict (inventarisasi_tahun_id, master_aset_id) do update set master_ruangan_id = excluded.master_ruangan_id, jumlah_scan = public.inventarisasi_aset.jumlah_scan + 1, last_scanned_at = now(), updated_at = now()
  returning * into v_aset;
  insert into public.inventarisasi_scan_log(inventarisasi_aset_id, master_ruangan_id, image_path, scanned_by)
  values (v_aset.id, p_ruangan_id, p_image_path, v_name);
  return v_aset;
end $$;

grant execute on function public.record_guest_inventarisasi_scan(uuid, uuid, uuid, text, text) to anon, authenticated;

drop policy if exists inventory_guest_photo_upload on storage.objects;
create policy inventory_guest_photo_upload on storage.objects for insert to anon, authenticated with check (bucket_id = 'inventarisasi-foto');
