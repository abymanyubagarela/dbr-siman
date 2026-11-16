begin;

grant select on public.inventarisasi_foto_ruangan to anon;

create policy inventory_room_photo_public_read
on public.inventarisasi_foto_ruangan
for select to anon
using (true);

commit;
