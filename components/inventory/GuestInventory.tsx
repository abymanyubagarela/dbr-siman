"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CameraBarcodeScanner } from "@/components/inventory/CameraBarcodeScanner";
import { setPageLoading } from "@/components/ui/PageLoader";
import { recordGuestScan, resolveAsset } from "@/lib/inventory";
import { supabase, type MasterRuangan } from "@/lib/supabase";

type RoomOption = Pick<MasterRuangan, "id" | "nama_ruang" | "jenis_ruang">;

const roomLabel = (room: RoomOption) => `${room.jenis_ruang?.trim() || "Tanpa Jenis Ruang"} — ${room.nama_ruang}`;

export default function GuestInventory({ title = "Inventarisasi Guest" }: { title?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoStreamRef = useRef<MediaStream | null>(null);
  const [year, setYear] = useState<{ id: string; tahun: number } | null>(null);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [scannerName, setScannerName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [roomSearch, setRoomSearch] = useState("");
  const [roomListOpen, setRoomListOpen] = useState(false);
  const [photoCameraReady, setPhotoCameraReady] = useState(false);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("Masukkan nama, pilih ruangan, scan QR, lalu ambil foto.");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setPageLoading(saving); }, [saving]);

  useEffect(() => {
    let mounted = true;
    const loadInitialData = async () => {
      const [yearResult, roomsResult] = await Promise.all([
        supabase.from("inventarisasi_tahun").select("id,tahun").eq("is_locked", true).order("tahun", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("master_ruangan").select("id,nama_ruang,jenis_ruang").order("jenis_ruang").order("nama_ruang"),
      ]);
      if (!mounted) return;
      if (roomsResult.error) setMessage("Daftar master ruangan tidak dapat dimuat. Coba muat ulang halaman.");
      else setRooms(roomsResult.data ?? []);
      setRoomsLoading(false);
      if (yearResult.error || !yearResult.data) setMessage("Belum ada tahun inventaris yang dikunci admin.");
      else setYear(yearResult.data);
      setLoading(false);
    };
    void loadInitialData();
    return () => {
      mounted = false;
      photoStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const filteredRooms = useMemo(() => {
    const search = roomSearch.trim().toLocaleLowerCase("id-ID");
    if (!search || roomId && roomSearch === roomLabel(rooms.find((room) => room.id === roomId)!)) return rooms;
    return rooms.filter((room) => roomLabel(room).toLocaleLowerCase("id-ID").includes(search));
  }, [roomId, roomSearch, rooms]);

  const compressPhoto = async (blob: Blob) => {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1280 / bitmap.width);
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    context?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let quality = 0.82;
    let result: Blob | null = null;
    do {
      result = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      quality -= 0.08;
    } while (result && result.size > 500 * 1024 && quality > 0.2);
    bitmap.close();
    return result ?? blob;
  };

  const takePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !photoCameraReady) return;
    const context = canvasRef.current.getContext("2d");
    if (!context || !videoRef.current.videoWidth) {
      setMessage("Kamera belum siap. Tunggu sebentar lalu coba lagi.");
      return;
    }
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.86);
    try {
      const response = await fetch(dataUrl);
      setPhoto(await compressPhoto(await response.blob()));
      setPreview(dataUrl);
      photoStreamRef.current?.getTracks().forEach((track) => track.stop());
      photoStreamRef.current = null;
      videoRef.current.srcObject = null;
      setPhotoCameraReady(false);
      setMessage("Foto siap. Periksa hasil scan, lalu simpan.");
    } catch {
      setMessage("Foto gagal diproses. Silakan ambil ulang.");
    }
  };

  const startPhotoCamera = async () => {
    if (!videoRef.current) return;
    photoStreamRef.current?.getTracks().forEach((track) => track.stop());
    setPreview(null);
    setPhoto(null);
    setPhotoCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      photoStreamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setPhotoCameraReady(true);
      setMessage("Kamera siap. Tekan Ambil Foto untuk melanjutkan.");
    } catch {
      setMessage("Kamera tidak dapat diakses. Periksa izin kamera browser.");
    }
  };

  const submit = async () => {
    if (!year || !scannerName.trim() || !roomId || !photo || !code.trim()) {
      setMessage("Lengkapi nama, ruangan, hasil scan QR, dan foto terlebih dahulu.");
      return;
    }
    setSaving(true);
    try {
      const assetResult = await resolveAsset(code.trim());
      const asset = assetResult.data?.[0];
      if (assetResult.error || !asset) {
        setMessage("Aset tidak ditemukan dari kode register.");
        return;
      }
      const path = `${year.id}/${asset.id}/${crypto.randomUUID()}.jpg`;
      const upload = await supabase.storage.from("inventarisasi-foto").upload(path, photo, { contentType: "image/jpeg", upsert: false });
      if (upload.error) {
        setMessage(`Foto gagal diunggah: ${upload.error.message}`);
        return;
      }
      const result = await recordGuestScan(year.id, asset.id, roomId, path, scannerName.trim());
      if (result.error) {
        setMessage(`Scan gagal: ${result.error.message}`);
        return;
      }
      setCode("");
      setPhoto(null);
      setPreview(null);
      setMessage(`Scan berhasil disimpan. ${scannerName.trim()} dan ruangan tetap dipilih untuk item berikutnya.`);
    } catch {
      setMessage("Scan gagal disimpan. Periksa koneksi lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="h-screen overflow-y-auto bg-[#f4f7f5] px-4 py-6 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 rounded-3xl bg-[#165b42] p-6 text-white shadow-xl">
          <div className="flex items-center gap-3"><span className="text-3xl" aria-hidden="true">▱</span><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">OpenLogistics</p><h1 className="text-2xl font-bold">{title}</h1></div></div>
          <p className="mt-4 text-sm text-emerald-50">Tahun inventaris ditentukan oleh admin.</p>
        </header>

        <section className="flex flex-col gap-5 rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-7">
          <div>
            <label htmlFor="scanner-name" className="text-sm font-semibold">Nama Scanner</label>
            <input id="scanner-name" value={scannerName} onChange={(event) => setScannerName(event.target.value)} placeholder="Masukkan Nama Anda" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3" autoComplete="name" />
          </div>

          <div className="relative">
            <label htmlFor="room-search" className="text-sm font-semibold">Pilih Ruangan</label>
            <input
              id="room-search"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={roomListOpen}
              aria-controls="master-room-options"
              aria-activedescendant={undefined}
              value={roomSearch}
              onFocus={() => setRoomListOpen(true)}
              onBlur={() => window.setTimeout(() => setRoomListOpen(false), 120)}
              onKeyDown={(event) => { if (event.key === "Escape") setRoomListOpen(false); }}
              onChange={(event) => { setRoomSearch(event.target.value); setRoomId(""); setRoomListOpen(true); }}
              placeholder="Cari jenis ruang atau nama ruang"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"
              autoComplete="off"
            />
            {roomListOpen && (
              <div id="master-room-options" role="listbox" aria-label="Daftar jenis dan nama ruang" className="absolute inset-x-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                {roomsLoading ? <p className="px-3 py-3 text-sm text-slate-500">Memuat master ruangan...</p> : filteredRooms.length ? filteredRooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    role="option"
                    aria-selected={roomId === room.id}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => { setRoomId(room.id); setRoomSearch(roomLabel(room)); setRoomListOpen(false); }}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none"
                  >
                    <span className="font-semibold text-slate-800">{room.jenis_ruang?.trim() || "Tanpa Jenis Ruang"}</span><span className="mx-2 text-slate-400">—</span><span className="text-slate-600">{room.nama_ruang}</span>
                  </button>
                )) : <p className="px-3 py-3 text-sm text-slate-500">{rooms.length ? "Ruangan tidak ditemukan." : "Belum ada data pada master ruangan."}</p>}
              </div>
            )}
            <p className="mt-1.5 text-xs text-slate-500">Pilih jenis ruang — nama ruang dari master ruangan.</p>
          </div>

          <div>
            <label className="text-sm font-semibold">Scan QR / Barcode</label>
            <div className="mt-2"><CameraBarcodeScanner disabled={loading || saving} onDetected={setCode} /></div>
            {code && <p className="mt-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-[#165b42]">Kode: {code}</p>}
          </div>

          <div>
            <label className="text-sm font-semibold">Foto Barang</label>
            <div className="mt-2 overflow-hidden rounded-2xl bg-slate-950">
              <video ref={videoRef} autoPlay muted playsInline className={`aspect-video w-full object-cover ${preview ? "hidden" : ""}`} aria-label="Kamera foto barang" />
              {preview && <img src={preview} alt="Pratinjau foto barang" className="aspect-video w-full object-cover" />}
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => void startPhotoCamera()} disabled={saving} className="flex-1 rounded-xl border border-emerald-200 px-4 py-3 text-sm font-semibold text-[#197a58] disabled:opacity-50">Buka Kamera</button>
              <button type="button" onClick={() => void takePhoto()} disabled={!photoCameraReady || saving} className="flex-1 rounded-xl bg-[#197a58] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Ambil Foto</button>
            </div>
            <p className="mt-2 text-xs text-slate-500">Foto dikompres maksimal 500 KB sebelum diunggah.</p>
          </div>

          <button type="button" disabled={loading || saving || !year} onClick={() => void submit()} className="w-full rounded-xl bg-[#165b42] px-4 py-3.5 font-bold text-white transition hover:bg-[#0f4632] disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Menyimpan Scan..." : "Simpan Scan"}</button>
          <p role="status" aria-live="polite" className="text-center text-sm text-slate-500">{message}</p>
        </section>
        <p className="mt-5 text-center text-xs text-slate-400">Tahun Aktif: {year?.tahun ?? "Belum Dikunci"}</p>
      </div>
    </main>
  );
}
