"use client";

import { useEffect, useRef, useState } from "react";
import { CameraBarcodeScanner } from "@/components/inventory/CameraBarcodeScanner";
import { setPageLoading } from "@/components/ui/PageLoader";
import { recordGuestScan, resolveAsset } from "@/lib/inventory";
import { supabase, type MasterRuangan } from "@/lib/supabase";

type RoomOption = Pick<MasterRuangan, "id" | "nama_ruang" | "jenis_ruang">;

export default function GuestInventory({ title = "Inventarisasi Guest" }: { title?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [year, setYear] = useState<{ id: string; tahun: number } | null>(null);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [scannerName, setScannerName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("Pilih ruangan, ambil foto, lalu scan aset.");
  const [busy, setBusy] = useState(true);

  useEffect(() => { setPageLoading(busy); }, [busy]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [yearResult, roomsResult] = await Promise.all([
        supabase.from("inventarisasi_tahun").select("id,tahun").eq("is_locked", true).order("tahun", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("master_ruangan").select("id,nama_ruang,jenis_ruang").order("jenis_ruang").order("nama_ruang"),
      ]);
      if (!mounted) return;
      if (roomsResult.error) setMessage("Daftar master ruangan tidak dapat dimuat.");
      else setRooms(roomsResult.data ?? []);
      if (yearResult.error || !yearResult.data) setMessage("Belum ada tahun inventaris yang dikunci admin.");
      else setYear(yearResult.data);
      setBusy(false);
    })();
    return () => { mounted = false; };
  }, []);

  const compressPhoto = async (blob: Blob) => { const bitmap = await createImageBitmap(blob); const canvas = document.createElement("canvas"); const scale = Math.min(1, 1280 / bitmap.width); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale); const context = canvas.getContext("2d"); context?.drawImage(bitmap, 0, 0, canvas.width, canvas.height); let quality = 0.82; let result: Blob | null = null; do { result = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality)); quality -= 0.08; } while (result && result.size > 500 * 1024 && quality > 0.2); bitmap.close(); return result ?? blob; };

  const takePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const context = canvasRef.current.getContext("2d");
    if (!context) return;
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.86);
    const response = await fetch(dataUrl);
    setPhoto(await compressPhoto(await response.blob()));
    setPreview(dataUrl);
    videoRef.current.srcObject && (videoRef.current.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
    setMessage("Foto siap. Sekarang scan barcode atau QR aset.");
  };

  const startPhotoCamera = async () => {
    if (!videoRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    videoRef.current.srcObject = stream;
    await videoRef.current.play();
  };

  const submit = async () => {
    if (!year || !scannerName.trim() || !roomId || !photo || !code.trim()) return setMessage("Lengkapi nama, ruangan, foto, dan barcode aset.");
    setBusy(true);
    const assetResult = await resolveAsset(code.trim());
    const asset = assetResult.data?.[0];
    if (assetResult.error || !asset) { setBusy(false); return setMessage("Aset tidak ditemukan dari kode register."); }
    const path = `${year.id}/${asset.id}/${crypto.randomUUID()}.jpg`;
    const upload = await supabase.storage.from("inventarisasi-foto").upload(path, photo, { contentType: "image/jpeg", upsert: false });
    if (upload.error) { setBusy(false); return setMessage(`Foto gagal diunggah: ${upload.error.message}`); }
    const result = await recordGuestScan(year.id, asset.id, roomId, path, scannerName);
    setBusy(false);
    if (result.error) return setMessage(`Scan gagal: ${result.error.message}`);
    setCode(""); setRoomId(""); setPhoto(null); setPreview(null); setMessage(`Scan berhasil disimpan. ${scannerName} siap untuk aset berikutnya.`);
  };

  return <main className="h-screen overflow-y-auto bg-[#f4f7f5] px-4 py-6 text-slate-900 sm:px-8"><div className="mx-auto max-w-2xl"><header className="mb-6 rounded-3xl bg-[#165b42] p-6 text-white shadow-xl"><div className="flex items-center gap-3"><span className="text-3xl" aria-hidden="true">▱</span><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">OpenLogistics</p><h1 className="text-2xl font-bold">{title}</h1></div></div><p className="mt-4 text-sm text-emerald-50">Scan Barang Berdasarkan Ruangan</p></header><section className="space-y-5 rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-7"><div><label className="text-sm font-semibold">Nama Scanner</label><input value={scannerName} onChange={(event) => setScannerName(event.target.value)} placeholder="Masukkan Nama Anda" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3" autoComplete="name" /></div><div><label className="text-sm font-semibold">Pilih Ruangan</label><select value={roomId} onChange={(event) => setRoomId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"><option value="">Pilih Ruangan</option>{Object.entries(rooms.reduce<Record<string, RoomOption[]>>((groups, room) => { const jenis = room.jenis_ruang?.trim() || "Tanpa Jenis Ruang"; (groups[jenis] ??= []).push(room); return groups; }, {})).map(([jenis, groupedRooms]) => <optgroup key={jenis} label={jenis}>{groupedRooms.map((room) => <option key={room.id} value={room.id}>{room.nama_ruang}</option>)}</optgroup>)}</select></div><div><label className="text-sm font-semibold">Foto Barang</label><div className="mt-2 overflow-hidden rounded-2xl bg-slate-950"><video ref={videoRef} autoPlay muted playsInline className={`aspect-video w-full object-cover ${preview ? "hidden" : ""}`} aria-label="Kamera foto barang" />{preview && <img src={preview} alt="Pratinjau foto barang" className="aspect-video w-full object-cover" />} </div><canvas ref={canvasRef} className="hidden" /><div className="mt-3 flex gap-2"><button type="button" onClick={() => void startPhotoCamera()} className="flex-1 rounded-xl border border-emerald-200 px-4 py-3 text-sm font-semibold text-[#197a58]">Buka Kamera</button><button type="button" onClick={() => void takePhoto()} disabled={!videoRef.current?.srcObject} className="flex-1 rounded-xl bg-[#197a58] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">Ambil Foto</button></div></div><div><label className="text-sm font-semibold">Scan Barcode / QR</label><div className="mt-2"><CameraBarcodeScanner disabled={!photo || busy} onDetected={setCode} /></div>{code && <p className="mt-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-[#165b42]">Kode: {code}</p>}</div><button type="button" disabled={busy || !year} onClick={() => void submit()} className="w-full rounded-xl bg-[#165b42] px-4 py-3.5 font-bold text-white transition hover:bg-[#0f4632] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Menyiapkan Data..." : "Submit Scan"}</button><p className="text-center text-sm text-slate-500">{message}</p></section><p className="mt-5 text-center text-xs text-slate-400">Tahun Aktif: {year?.tahun ?? "Belum Dikunci"}</p></div></main>;
}
