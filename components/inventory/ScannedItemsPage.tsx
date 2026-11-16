"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { setPageLoading } from "@/components/ui/PageLoader";
import { supabase, type MasterRuangan } from "@/lib/supabase";

type ScanRow = {
  id: string;
  scanned_by: string | null;
  image_path: string;
  scanned_at: string;
  master_ruangan: { id: string; nama_ruang: string; jenis_ruang: string | null } | null;
  inventarisasi_aset: {
    master_aset: { kode_register: string | null; kode_barang: string | null; nup: string | null; nama_barang: string | null; merk: string | null } | null;
    inventarisasi_tahun: { id: string; tahun: number } | null;
  } | null;
};

type InventoryYear = { id: string; tahun: number; is_locked: boolean };

export default function ScannedItemsPage() {
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [rooms, setRooms] = useState<MasterRuangan[]>([]);
  const [years, setYears] = useState<InventoryYear[]>([]);
  const [yearId, setYearId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [yearResult, roomResult, adminResult] = await Promise.all([
      supabase.from("inventarisasi_tahun").select("id,tahun,is_locked").order("tahun", { ascending: false }),
      supabase.from("master_ruangan").select("id,nama_ruang,jenis_ruang").order("nama_ruang"),
      supabase.rpc("is_inventory_admin"),
    ]);
    setIsAdmin(adminResult.data === true);
    if (yearResult.error || roomResult.error) {
      setError("Data inventaris tidak dapat dimuat. Periksa koneksi dan izin akses.");
      setLoading(false);
      return;
    }
    const yearData = (yearResult.data ?? []) as InventoryYear[];
    const roomData = (roomResult.data ?? []) as MasterRuangan[];
    setYears(yearData);
    setRooms(roomData);
    const selectedYear = yearId || yearData.find((year) => year.is_locked)?.id || "";
    setYearId(selectedYear);
    if (!selectedYear) {
      setRows([]);
      setLoading(false);
      return;
    }
    let query = supabase
      .from("inventarisasi_scan_log")
      .select("id,scanned_by,image_path,scanned_at,master_ruangan(*),inventarisasi_aset!inner(inventarisasi_tahun_id,master_aset(*))")
      .eq("inventarisasi_aset.inventarisasi_tahun_id", selectedYear)
      .order("scanned_at", { ascending: false });
    if (roomId) query = query.eq("master_ruangan_id", roomId);
    const result = await query;
    if (result.error) setError("Daftar scan tidak dapat dimuat. Pastikan migrasi inventaris sudah diterapkan.");
    else {
      const mapped = (result.data ?? []).map((row: any) => ({
        ...row,
        inventarisasi_aset: {
          ...row.inventarisasi_aset,
          inventarisasi_tahun: yearData.find((year) => year.id === selectedYear) ?? null,
        },
      })) as ScanRow[];
      setRows(mapped);
    }
    setLoading(false);
  }, [roomId, yearId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPageLoading(loading); return () => setPageLoading(false); }, [loading]);

  const handleDelete = async (row: ScanRow) => {
    const assetName = row.inventarisasi_aset?.master_aset?.nama_barang || "hasil scan ini";
    if (!window.confirm(`Hapus ${assetName}? Hasil scan dan foto terkait akan dihapus permanen.`)) return;

    setDeletingId(row.id);
    setError("");
    setNotice("");
    try {
      const { data, error: deleteError } = await supabase.rpc("delete_inventarisasi_scan", { p_scan_log_id: row.id });
      if (deleteError) {
        setError("Hasil scan gagal dihapus. Pastikan akun Anda memiliki akses admin, lalu coba lagi.");
        return;
      }

      setRows((currentRows) => currentRows.filter((currentRow) => currentRow.id !== row.id));
      if (data?.image_path) {
        const { error: photoError } = await supabase.storage.from("inventarisasi-foto").remove([data.image_path]);
        setNotice(photoError
          ? "Hasil scan telah dihapus, tetapi foto terkait gagal dihapus."
          : "Hasil scan dan foto terkait berhasil dihapus.");
      } else {
        setNotice("Hasil scan berhasil dihapus.");
      }
    } catch {
      setError("Hasil scan gagal dihapus. Periksa koneksi lalu coba lagi.");
    } finally {
      setDeletingId(null);
    }
  };

  const roomGroups = useMemo(() => Object.entries(rooms.reduce<Record<string, MasterRuangan[]>>((groups, room) => {
    const type = room.jenis_ruang?.trim() || "Tanpa Jenis Ruang";
    (groups[type] ??= []).push(room);
    return groups;
  }, {})), [rooms]);

  return <section className="mx-auto max-w-7xl p-5 sm:p-8">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#197a58]">Inventarisasi</p><h1 className="mt-2 text-3xl font-black tracking-tight">Daftar Barang Ter-scan</h1><p className="mt-2 text-sm text-slate-500">Riwayat barang yang sudah dipindai berdasarkan tahun dan ruangan.</p></div>
      <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-[#197a58]">{rows.length.toLocaleString("id-ID")} Hasil Scan</span>
    </header>
    <div className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
      <label className="text-sm font-semibold text-slate-700">Tahun Inventaris<select value={yearId} onChange={(event) => setYearId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal"><option value="">Pilih Tahun</option>{years.map((year) => <option key={year.id} value={year.id}>{year.tahun}{year.is_locked ? " · Terkunci" : " · Terbuka"}</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-700">Filter Ruangan<select value={roomId} onChange={(event) => setRoomId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal"><option value="">Semua Ruangan</option>{roomGroups.map(([type, group]) => <optgroup key={type} label={type}>{group.map((room) => <option key={room.id} value={room.id}>{room.nama_ruang}</option>)}</optgroup>)}</select></label>
    </div>
    {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-4">Barang</th><th className="px-5 py-4">Kode Register</th><th className="px-5 py-4">Jenis Ruang</th><th className="px-5 py-4">Ruangan</th><th className="px-5 py-4">Di-scan Oleh</th><th className="px-5 py-4">Waktu Scan</th>{isAdmin && <th className="px-5 py-4">Tindakan</th>}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => { const asset = row.inventarisasi_aset?.master_aset; return <tr key={row.id} className="hover:bg-emerald-50/40"><td className="px-5 py-4"><p className="font-bold text-slate-800">{asset?.nama_barang || "Tanpa Nama"}</p><p className="mt-1 text-xs text-slate-500">{asset?.merk || "Merk Tidak Diisi"}</p><p className="mt-1 text-xs text-slate-500">Kode Barang: {asset?.kode_barang || "—"} · NUP: {asset?.nup ?? "—"}</p></td><td className="px-5 py-4 font-mono text-xs text-slate-600">{asset?.kode_register || asset?.kode_barang || "—"}</td><td className="px-5 py-4 text-slate-600">{row.master_ruangan?.jenis_ruang || "Tanpa Jenis Ruang"}</td><td className="px-5 py-4 font-medium text-slate-700">{row.master_ruangan?.nama_ruang || "—"}</td><td className="px-5 py-4 text-slate-600">{row.scanned_by || "—"}</td><td className="px-5 py-4 text-slate-500">{new Date(row.scanned_at).toLocaleString("id-ID")}</td>{isAdmin && <td className="px-5 py-4"><button type="button" onClick={() => void handleDelete(row)} disabled={deletingId === row.id} aria-label={`Hapus hasil scan ${asset?.nama_barang || "tanpa nama"}`} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60">{deletingId === row.id ? "Menghapus…" : "Hapus"}</button></td>}</tr>; })}{!loading && rows.length === 0 && <tr><td colSpan={isAdmin ? 7 : 6} className="px-5 py-16 text-center text-slate-500">Belum ada barang yang di-scan untuk filter ini.</td></tr>}</tbody></table></div></div>
  </section>;
}
