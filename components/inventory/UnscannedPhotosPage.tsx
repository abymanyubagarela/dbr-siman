"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { setPageLoading } from "@/components/ui/PageLoader";
import { supabase } from "@/lib/supabase";

type InventoryYear = { id: string; tahun: number; is_locked: boolean };
type Room = { id: string; nama_ruang: string; jenis_ruang: string | null };
type PhotoOnlyRecord = {
  id: string;
  inventarisasi_tahun_id: string;
  master_ruangan_id: string;
  image_path: string;
  scanned_by: string;
  created_at: string;
};
type PageOptions = { years: InventoryYear[]; rooms: Room[] };
type PhotoPageKey = readonly ["unscanned-photo-records", string, string, number];
type PhotoPageKeyLoader = (pageIndex: number, previousPageData: PhotoOnlyRecord[] | null) => PhotoPageKey | null;

const PAGE_SIZE = 30;

async function loadOptions(): Promise<PageOptions> {
  const [yearResult, roomResult] = await Promise.all([
    supabase.from("inventarisasi_tahun").select("id,tahun,is_locked").order("tahun", { ascending: false }),
    supabase.from("master_ruangan").select("id,nama_ruang,jenis_ruang").order("nama_ruang"),
  ]);
  if (yearResult.error || roomResult.error) throw new Error("Pilihan tahun atau ruangan gagal dimuat.");
  return {
    years: (yearResult.data ?? []) as InventoryYear[],
    rooms: (roomResult.data ?? []) as Room[],
  };
}

async function loadPhotoRecords(yearId: string, roomId: string, pageIndex: number) {
  let query = supabase
    .from("inventarisasi_foto_ruangan")
    .select("id,inventarisasi_tahun_id,master_ruangan_id,image_path,scanned_by,created_at")
    .eq("inventarisasi_tahun_id", yearId)
    .order("created_at", { ascending: false })
    .range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1);
  if (roomId) query = query.eq("master_ruangan_id", roomId);
  const { data, error } = await query;
  if (error) throw new Error("Daftar foto tidak dapat dimuat. Periksa hak akses staf inventaris.");
  return (data ?? []) as PhotoOnlyRecord[];
}

export default function UnscannedPhotosPage() {
  const [requestedYearId, setRequestedYearId] = useState("");
  const [roomId, setRoomId] = useState("");
  const { data: options, error: optionsError, isLoading: optionsLoading, mutate: refreshOptions } = useSWR("unscanned-photo-options", loadOptions);
  const selectedYearId = requestedYearId || options?.years.find((year) => year.is_locked)?.id || options?.years[0]?.id || "";
  const {
    data: recordPages,
    error: recordsError,
    isLoading: recordsLoading,
    isValidating: recordsValidating,
    size: pageCount,
    setSize: setPageCount,
    mutate: refreshRecords,
  } = useSWRInfinite<PhotoOnlyRecord[], Error, PhotoPageKeyLoader>(
    (pageIndex, previousPageData) => {
      if (!selectedYearId || (previousPageData && previousPageData.length < PAGE_SIZE)) return null;
      return ["unscanned-photo-records", selectedYearId, roomId, pageIndex] as const;
    },
    ([, yearId, selectedRoomId, pageIndex]) => loadPhotoRecords(yearId, selectedRoomId, pageIndex),
    { persistSize: false, revalidateFirstPage: false },
  );
  const photos = recordPages?.flat() ?? [];
  const lastPage = recordPages?.[recordPages.length - 1];
  const hasMore = (lastPage?.length ?? 0) === PAGE_SIZE;
  const loading = optionsLoading || (Boolean(selectedYearId) && recordsLoading);
  const error = optionsError || recordsError;
  const roomById = useMemo(() => new Map((options?.rooms ?? []).map((room) => [room.id, room])), [options?.rooms]);

  useEffect(() => {
    setPageLoading(loading);
    return () => setPageLoading(false);
  }, [loading]);

  const refresh = async () => {
    await Promise.all([refreshOptions(), refreshRecords()]);
  };

  return (
    <section className="mx-auto max-w-7xl p-5 sm:p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#197a58]">Inventarisasi</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Hasil Foto Tidak Terscan</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">Daftar barang yang difoto saat QR atau barcode tidak terbaca. Foto tersimpan tanpa menambah hitungan scan aset.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-[#197a58]">{photos.length.toLocaleString("id-ID")} foto ditampilkan</span>
          <button type="button" onClick={() => void refresh()} disabled={loading} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-[#176e4f] disabled:opacity-50">Muat ulang</button>
        </div>
      </header>

      <div className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">
          Tahun Inventaris
          <select value={selectedYearId} onChange={(event) => setRequestedYearId(event.target.value)} disabled={optionsLoading} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal">
            {!options?.years.length && <option value="">Belum ada tahun inventaris</option>}
            {options?.years.map((year) => <option key={year.id} value={year.id}>{year.tahun}{year.is_locked ? " · Terkunci" : " · Terbuka"}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Filter Ruangan
          <select value={roomId} onChange={(event) => setRoomId(event.target.value)} disabled={optionsLoading} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal">
            <option value="">Semua Ruangan</option>
            {(options?.rooms ?? []).map((room) => <option key={room.id} value={room.id}>{room.jenis_ruang?.trim() || "Tanpa Jenis Ruang"} — {room.nama_ruang}</option>)}
          </select>
        </label>
      </div>

      {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error instanceof Error ? error.message : "Terjadi kesalahan saat memuat hasil foto."}</p>}

      {loading ? (
        <div role="status" className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500">Memuat hasil foto...</div>
      ) : photos.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {photos.map((photo) => {
            const room = roomById.get(photo.master_ruangan_id);
            const imageUrl = supabase.storage.from("inventarisasi-foto").getPublicUrl(photo.image_path).data.publicUrl;
            const roomName = room?.nama_ruang || "Ruangan tidak diketahui";
            return (
              <article key={photo.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <a href={imageUrl} target="_blank" rel="noreferrer" aria-label={`Buka foto barang di ${roomName}`} className="group relative block aspect-[4/3] overflow-hidden bg-slate-100">
                  <img src={imageUrl} alt={`Foto barang yang belum terscan di ${roomName}`} className="size-full object-cover transition duration-300 group-hover:scale-[1.03]" loading="lazy" />
                  <span className="absolute left-3 top-3 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">Belum terscan</span>
                </a>
                <div className="p-4">
                  <p className="font-bold text-slate-800">{roomName}</p>
                  <p className="mt-1 text-sm text-slate-500">{room?.jenis_ruang?.trim() || "Tanpa Jenis Ruang"}</p>
                  <div className="mt-4 flex flex-wrap items-end justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <span>Difoto oleh <strong className="font-semibold text-slate-700">{photo.scanned_by || "—"}</strong></span>
                    <time dateTime={photo.created_at}>{new Date(photo.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</time>
                  </div>
                  <a href={imageUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-lg px-2 py-1 text-sm font-semibold text-[#176e4f] hover:bg-emerald-50">Buka foto</a>
                </div>
              </article>
            );
          })}
        </div>
      ) : !error && selectedYearId ? (
        <div role="status" className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
          <p className="text-lg font-bold text-slate-700">Belum ada foto barang tidak terscan</p>
          <p className="mt-2 text-sm text-slate-500">Foto dari mode Foto Saja akan muncul di sini.</p>
        </div>
      ) : !error && !optionsLoading ? (
        <div role="status" className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center text-sm text-slate-500">Belum ada tahun inventaris.</div>
      ) : null}
      {!error && photos.length > 0 && hasMore && <div className="mt-6 text-center"><button type="button" onClick={() => void setPageCount(pageCount + 1)} disabled={recordsValidating} className="rounded-xl border border-emerald-200 bg-white px-5 py-3 text-sm font-semibold text-[#176e4f] transition hover:bg-emerald-50 disabled:opacity-50">{recordsValidating ? "Memuat foto..." : "Muat Foto Lainnya"}</button></div>}
    </section>
  );
}
