"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, type MasterAset, type MasterRuangan } from "@/lib/supabase";
import {
  getInventoryAssets,
  getInventoryRooms,
  getInventoryYears,
  recordScan,
  resolveAsset,
  type InventoryAsset,
  type InventoryYear,
} from "@/lib/inventory";

const button =
  "rounded-xl bg-[#197a58] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#11523c] disabled:cursor-not-allowed disabled:opacity-50";

export default function InventoryModule() {
  const [years, setYears] = useState<InventoryYear[]>([]);
  const [rooms, setRooms] = useState<MasterRuangan[]>([]);
  const [records, setRecords] = useState<InventoryAsset[]>([]);
  const [yearId, setYearId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [barcode, setBarcode] = useState("");
  const [asset, setAsset] = useState<MasterAset | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [showMissing, setShowMissing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const year = years.find((item) => item.id === yearId);
  const room = rooms.find((item) => item.id === roomId);
  const reload = useCallback(async () => {
    const [yearResult, roomResult] = await Promise.all([
      getInventoryYears(),
      getInventoryRooms(),
    ]);
    if (yearResult.data) {
      setYears(yearResult.data as InventoryYear[]);
      if (!yearId && yearResult.data[0]) setYearId(yearResult.data[0].id);
    }
    if (roomResult.data) setRooms(roomResult.data as MasterRuangan[]);
  }, [yearId]);
  const reloadRecords = useCallback(async () => {
    if (!yearId) return;
    const result = await getInventoryAssets(yearId);
    if (result.data) setRecords(result.data as InventoryAsset[]);
  }, [yearId]);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    void reloadRecords();
  }, [reloadRecords]);
  const createYear = async () => {
    setBusy(true);
    const result = await supabase
      .from("inventarisasi_tahun")
      .insert({ tahun: newYear })
      .select()
      .single();
    setBusy(false);
    if (result.error) return setMessage(result.error.message);
    setMessage("Tahun inventaris dibuat.");
    await reload();
  };
  const lockYear = async () => {
    if (
      !yearId ||
      !confirm("Kunci tahun inventaris ini? Scan baru tidak akan diterima.")
    )
      return;
    setBusy(true);
    const result = await supabase.rpc("lock_inventarisasi_tahun", {
      p_tahun_id: yearId,
    });
    setBusy(false);
    setMessage(result.error?.message ?? "Tahun inventaris dikunci.");
    await reload();
  };
  const findAsset = async () => {
    if (!barcode.trim()) return;
    setBusy(true);
    const result = await resolveAsset(barcode.trim());
    setBusy(false);
    if (result.error) return setMessage(result.error.message);
    if (!result.data?.length)
      return setMessage(
        "Aset tidak ditemukan. Gunakan kode register atau kode barang.",
      );
    if (result.data.length > 1)
      return setMessage("Kode tidak unik. Gunakan kode register.");
    setAsset(result.data[0] as MasterAset);
    setMessage("Aset ditemukan. Ambil foto lalu simpan scan.");
  };
  const saveScan = async () => {
    if (!yearId || !roomId || !asset || !photo)
      return setMessage(
        "Pilih tahun, ruangan, aset, dan foto terlebih dahulu.",
      );
    if (year?.is_locked) return setMessage("Tahun inventaris sudah dikunci.");
    setBusy(true);
    const finalPath = `${yearId}/${asset.id}/${crypto.randomUUID()}.jpg`;
    const upload = await supabase.storage
      .from("inventarisasi-foto")
      .upload(finalPath, photo, {
        contentType: photo.type || "image/jpeg",
        upsert: false,
      });
    console.log("UPLOAD RESULT:", {
      path: finalPath,
      error: upload.error,
      data: upload.data,
    });


    if (upload.error) {
      setBusy(false);
      return setMessage(`Foto gagal diunggah: ${upload.error.message}`);
    }
    const result = await recordScan(yearId, asset.id, roomId, finalPath);

    console.log("RECORD SCAN ERROR:", {
      error: result.error,
      message: result.error?.message,
      code: result.error?.code,
      details: result.error?.details,
      hint: result.error?.hint,
    });

    if (result.error) {
      setBusy(false);
      return setMessage(`Scan gagal: ${result.error.message}`);
    }
    setBusy(false);
    setMessage(
      `Berhasil mencatat ${asset.nama_barang ?? "aset"} di ${room?.nama_ruang ?? "ruangan"}.`,
    );
    setBarcode("");
    setAsset(null);
    setPhoto(null);
    await reloadRecords();
    inputRef.current?.focus();
  };
  const missing = useMemo(() => records.length, [records]);
  return (
    <main className="min-h-screen bg-[#f5f7fb] px-5 py-8 text-[#111] lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#197a58]">
              SIMAN / Inventarisasi tahunan
            </p>
            <h1 className="mt-2 text-3xl font-black">
              Pemeriksaan aset berbasis ruangan
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Foto dulu, scan berikutnya. Setiap foto tersimpan sebagai histori
              permanen.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={yearId}
              onChange={(event) => setYearId(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">Pilih tahun</option>
              {years.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.tahun}
                  {item.is_locked ? " · Terkunci" : ""}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={newYear}
              onChange={(event) => setNewYear(Number(event.target.value))}
              className="w-24 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
            <button
              className={button}
              disabled={busy}
              onClick={() => void createYear()}
            >
              Buat tahun
            </button>
            {year && !year.is_locked && (
              <button
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white"
                disabled={busy}
                onClick={() => void lockYear()}
              >
                Kunci tahun
              </button>
            )}
          </div>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <section className="rounded-2xl bg-[#197a58] p-6 text-white shadow-lg shadow-emerald-900/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-100">
                  Sesi aktif
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  {year?.tahun ?? "—"} / {room?.nama_ruang ?? "Pilih ruangan"}
                </h2>
              </div>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
                {year?.is_locked ? "Terkunci" : "Terbuka"}
              </span>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <select
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
                className="rounded-xl border-0 bg-white px-3 py-3 text-sm font-semibold text-slate-900"
              >
                <option value="">Pilih ruangan</option>
                {rooms.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nama_ruang}
                  </option>
                ))}
              </select>
              <div className="rounded-xl bg-white/15 px-4 py-3 text-sm">
                <span className="block text-xs text-emerald-100">
                  Scan berhasil
                </span>
                <strong className="text-2xl">
                  {records.reduce((total, item) => total + item.jumlah_scan, 0)}
                </strong>
              </div>
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Perbandingan
            </p>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <p className="text-4xl font-black text-[#197a58]">
                  {records.length}
                </p>
                <p className="text-sm text-slate-500">aset unik ditemukan</p>
              </div>
              <button
                className="text-sm font-bold text-[#197a58]"
                onClick={() => setShowMissing((value) => !value)}
              >
                {showMissing ? "Sembunyikan" : "Lihat"} status
              </button>
            </div>
            <p className="mt-5 text-xs leading-5 text-slate-500">
              Belum dipindai tidak otomatis berarti hilang. Status hanya
              menunjukkan perbandingan dengan master aset.
            </p>
          </section>
        </div>
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">Scan aset</h2>
              <p className="text-sm text-slate-500">
                Alur cepat: foto, masukkan barcode, simpan otomatis.
              </p>
            </div>
            {message && (
              <p
                role="status"
                className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-[#197a58]"
              >
                {message}
              </p>
            )}
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.8fr]">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Foto aset
              </label>
              <input
                aria-label="Foto aset"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
                className="mt-2 block w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm"
              />
              {photo && (
                <p className="mt-2 text-xs text-emerald-700">
                  Foto siap: {photo.name}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Barcode / kode register
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  ref={inputRef}
                  value={barcode}
                  onChange={(event) => setBarcode(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.nativeEvent.isComposing &&
                      event.keyCode !== 229
                    )
                      void findAsset();
                  }}
                  placeholder="Scan dengan USB scanner"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-3 text-sm"
                />
                <button
                  className={button}
                  disabled={busy}
                  onClick={() => void findAsset()}
                >
                  Cari
                </button>
              </div>
              {asset && (
                <div className="mt-3 rounded-xl bg-slate-50 p-4 text-sm">
                  <p className="font-bold">
                    {asset.nama_barang ?? "Tanpa nama"}
                  </p>
                  <p className="mt-1 text-slate-500">
                    {asset.kode_register ?? asset.kode_barang ?? asset.id} ·{" "}
                    {asset.merk ?? "Merk tidak diisi"}
                  </p>
                  <button
                    className={`${button} mt-3 w-full`}
                    disabled={busy}
                    onClick={() => void saveScan()}
                  >
                    Simpan scan & foto
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
        {showMissing && (
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-black">Aset ditemukan tahun ini</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="pb-3">Aset</th>
                    <th className="pb-3">Ruangan terakhir</th>
                    <th className="pb-3">Jumlah scan</th>
                    <th className="pb-3">Terakhir scan</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="py-3 font-semibold">
                        {item.master_aset?.nama_barang ?? item.master_aset_id}
                      </td>
                      <td className="py-3">
                        {item.master_ruangan?.nama_ruang ??
                          item.master_ruangan_id}
                      </td>
                      <td className="py-3">{item.jumlah_scan}</td>
                      <td className="py-3 text-slate-500">
                        {new Date(item.last_scanned_at).toLocaleString("id-ID")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Total unik ditemukan: {missing}. Untuk daftar aset belum dipindai,
              bandingkan master_aset dengan daftar ini melalui filter
              administrasi.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
