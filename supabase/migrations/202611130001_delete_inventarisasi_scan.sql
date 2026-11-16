create or replace function public.delete_inventarisasi_scan(p_scan_log_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_asset_id uuid;
  v_year_id uuid;
  v_image_path text;
  v_remaining_count integer;
  v_latest_room_id uuid;
  v_latest_scanned_at timestamptz;
begin
  if not public.is_inventory_admin() then
    raise exception 'not authorized';
  end if;

  select l.inventarisasi_aset_id
  into v_asset_id
  from public.inventarisasi_scan_log as l
  where l.id = p_scan_log_id;
  if not found then
    raise exception 'scan not found';
  end if;

  select a.inventarisasi_tahun_id
  into v_year_id
  from public.inventarisasi_aset as a
  where a.id = v_asset_id;
  if not found then
    raise exception 'inventory asset not found';
  end if;

  perform 1
  from public.inventarisasi_tahun as y
  where y.id = v_year_id
  for update;
  if not found then
    raise exception 'inventory year not found';
  end if;

  perform 1
  from public.inventarisasi_aset as a
  where a.id = v_asset_id
  for update;
  if not found then
    raise exception 'inventory asset not found';
  end if;

  select l.image_path
  into v_image_path
  from public.inventarisasi_scan_log as l
  where l.id = p_scan_log_id
    and l.inventarisasi_aset_id = v_asset_id
  for update;
  if not found then
    raise exception 'scan not found';
  end if;

  delete from public.inventarisasi_scan_log as l
  where l.id = p_scan_log_id
  returning l.image_path into v_image_path;

  select count(*)::integer, max(l.scanned_at)
  into v_remaining_count, v_latest_scanned_at
  from public.inventarisasi_scan_log as l
  where l.inventarisasi_aset_id = v_asset_id;

  if v_remaining_count = 0 then
    delete from public.inventarisasi_aset as a where a.id = v_asset_id;
  else
    select l.master_ruangan_id
    into v_latest_room_id
    from public.inventarisasi_scan_log as l
    where l.inventarisasi_aset_id = v_asset_id
    order by l.scanned_at desc, l.created_at desc, l.id desc
    limit 1;

    update public.inventarisasi_aset
    set master_ruangan_id = v_latest_room_id,
        jumlah_scan = v_remaining_count,
        last_scanned_at = v_latest_scanned_at
    where id = v_asset_id;
  end if;

  return jsonb_build_object(
    'deleted_scan_id', p_scan_log_id,
    'image_path', v_image_path,
    'remaining_count', v_remaining_count,
    'asset_deleted', v_remaining_count = 0
  );
end;
$function$;

revoke all on function public.delete_inventarisasi_scan(uuid) from public;
grant execute on function public.delete_inventarisasi_scan(uuid) to authenticated;

drop policy if exists inventory_photo_staff on storage.objects;
drop policy if exists inventory_photo_staff_select on storage.objects;
drop policy if exists inventory_photo_staff_update on storage.objects;
drop policy if exists inventory_photo_admin_delete on storage.objects;
create policy inventory_photo_staff_select on storage.objects
  for select to authenticated
  using (bucket_id = 'inventarisasi-foto' and public.is_inventory_staff());
create policy inventory_photo_staff_update on storage.objects
  for update to authenticated
  using (bucket_id = 'inventarisasi-foto' and public.is_inventory_staff())
  with check (bucket_id = 'inventarisasi-foto' and public.is_inventory_staff());
create policy inventory_photo_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'inventarisasi-foto' and public.is_inventory_admin());
